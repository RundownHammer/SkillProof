import { prisma } from "@credential/database";
import { getBlockchainAdapter } from "@credential/blockchain";
import type { CertificateIssuanceJob } from "@credential/queue";

const adapter = getBlockchainAdapter();

// Short delay between stage transitions so the row's intermediate statuses are
// observable (DB polling / logs) rather than flipping to COMPLETED instantly.
const STAGE_DELAY_MS = Number(process.env.WORKER_STAGE_DELAY_MS ?? 50);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type IssuanceStatus =
  | "QUEUED"
  | "VALIDATING"
  | "HASHING"
  | "BLOCKCHAIN_PENDING"
  | "GENERATING_PDF"
  | "UPLOADING"
  | "COMPLETED";

export async function setStatus(certificateId: string, status: IssuanceStatus): Promise<void> {
  await prisma.certificate.update({
    where: { id: certificateId },
    data: { status },
  });
  console.log(`[issuance] certificate row ${certificateId} -> ${status}`);
}

/**
 * Processes one certificate-issuance job by walking the status state machine:
 * QUEUED -> VALIDATING -> HASHING -> BLOCKCHAIN_PENDING -> GENERATING_PDF
 * -> UPLOADING -> COMPLETED.
 *
 * Idempotent: each stage is guarded by the current row status, and the
 * blockchain transaction row is created only if one does not already exist
 * (the @unique certificateId also prevents duplicates on retry). Re-processing
 * the same certificateId after a partial failure resumes at the correct stage
 * and never produces duplicate BlockchainTransaction rows.
 */
export async function processIssuance(job: CertificateIssuanceJob): Promise<void> {
  const { certificateId } = job.data; // Certificate row's Prisma id (cuid)

  const cert = await prisma.certificate.findUnique({ where: { id: certificateId } });
  if (!cert) {
    throw new Error(`Certificate row ${certificateId} not found — cannot process issuance job`);
  }

  // Track status locally — setStatus updates the DB, not this object.
  // Inferred as CertificateStatus (full enum); setStatus's narrower param
  // type only accepts the valid transition targets we pass.
  let status = cert.status;
  const hash = cert.hash ?? "";

  // Stage: VALIDATING (from QUEUED)
  if (status === "QUEUED") {
    await setStatus(cert.id, "VALIDATING");
    status = "VALIDATING";
    await sleep(STAGE_DELAY_MS);
  }

  // Stage: HASHING — confirm the hash computed at issuance time is present.
  // Do NOT recompute it here (Phase 3 already stored canonicalJson + hash).
  if (status === "VALIDATING") {
    if (!hash) {
      throw new Error(`Certificate ${cert.certificateId} has no hash to anchor on-chain`);
    }
    await setStatus(cert.id, "HASHING");
    status = "HASHING";
    await sleep(STAGE_DELAY_MS);
  }

  // Stage: BLOCKCHAIN_PENDING — anchor the hash via the adapter (mock now).
  if (status === "HASHING") {
    await setStatus(cert.id, "BLOCKCHAIN_PENDING");
    status = "BLOCKCHAIN_PENDING";
    await sleep(STAGE_DELAY_MS);

    // Idempotent: only issue + write a tx row if one isn't already present.
    const existingTx = await prisma.blockchainTransaction.findUnique({
      where: { certificateId: cert.id },
    });
    if (!existingTx) {
      const { transactionHash } = await adapter.issueCertificate(cert.certificateId, hash);
      await prisma.blockchainTransaction.create({
        data: {
          certificateId: cert.id,
          transactionHash,
          status: "CONFIRMED",
          network: "mock",
        },
      });
      console.log(`[issuance] anchored ${cert.certificateId} on mock chain: ${transactionHash}`);
    }
  }

  // Stage: GENERATING_PDF (stub — real PDF in Phase 6)
  if (status === "BLOCKCHAIN_PENDING") {
    await setStatus(cert.id, "GENERATING_PDF");
    status = "GENERATING_PDF";
    await sleep(STAGE_DELAY_MS);
  }

  // Stage: UPLOADING (stub — real upload in Phase 6)
  if (status === "GENERATING_PDF") {
    await setStatus(cert.id, "UPLOADING");
    status = "UPLOADING";
    await sleep(STAGE_DELAY_MS);
  }

  // Stage: COMPLETED
  if (status === "UPLOADING") {
    await setStatus(cert.id, "COMPLETED");
    status = "COMPLETED";
  }

  if (status === "COMPLETED") {
    console.log(`[issuance] certificate ${cert.certificateId} COMPLETED`);
  }
}
