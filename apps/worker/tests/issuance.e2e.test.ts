import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@credential/database";
import {
  createCertificateIssuanceQueue,
  createCertificateIssuanceWorker,
  CERTIFICATE_ISSUANCE_QUEUE,
} from "@credential/queue";
import { processIssuance } from "../src/processor.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const connection = { url: redisUrl, maxRetriesPerRequest: null };

const EXPECTED_SEQUENCE = [
  "QUEUED",
  "VALIDATING",
  "HASHING",
  "BLOCKCHAIN_PENDING",
  "GENERATING_PDF",
  "UPLOADING",
  "COMPLETED",
] as const;

describe("certificate issuance E2E (queue + worker + Postgres)", () => {
  const suffix = `e2e-${Date.now()}`;
  let queue: ReturnType<typeof createCertificateIssuanceQueue>;
  let worker: ReturnType<typeof createCertificateIssuanceWorker>;
  let certId = "";
  let instituteId = "";
  let qualificationId = "";
  let studentId = "";

  beforeAll(async () => {
    // Minimal self-contained graph so the test doesn't depend on seed data.
    const institute = await prisma.institute.create({
      data: { name: "E2E Institute", code: `E2E-INST-${suffix}` },
    });
    const qualification = await prisma.qualification.create({
      data: { code: `E2E-QF-${suffix}`, title: "E2E Qualification", credits: 10 },
    });
    const student = await prisma.student.create({
      data: {
        fullName: "E2E Student",
        email: `e2e-student-${suffix}@example.com`,
        instituteId: institute.id,
      },
    });
    instituteId = institute.id;
    qualificationId = qualification.id;
    studentId = student.id;

    const cert = await prisma.certificate.create({
      data: {
        certificateId: `CERT-E2E-${suffix}`,
        studentId: student.id,
        qualificationId: qualification.id,
        instituteId: institute.id,
        credits: 10,
        grade: "A",
        issueDate: new Date("2026-06-30T00:00:00.000Z"),
        status: "QUEUED",
        canonicalJson: { certificateId: `CERT-E2E-${suffix}`, note: "e2e" },
        hash: "e2e-test-hash-0123456789abcdef",
      },
    });
    certId = cert.id;

    queue = createCertificateIssuanceQueue(connection);
    worker = createCertificateIssuanceWorker(processIssuance, connection);
    await worker.waitUntilReady();
    await queue.waitUntilReady();
  });

  afterAll(async () => {
    await worker?.close().catch(() => {});
    await queue?.obliterate({ force: true }).catch(() => {});
    await queue?.close().catch(() => {});
    // Clean up the graph we created (child rows first).
    await prisma.blockchainTransaction
      .deleteMany({ where: { certificateId: certId } })
      .catch(() => {});
    await prisma.certificate.deleteMany({ where: { id: certId } }).catch(() => {});
    await prisma.student.deleteMany({ where: { id: studentId } }).catch(() => {});
    await prisma.qualification.deleteMany({ where: { id: qualificationId } }).catch(() => {});
    await prisma.institute.deleteMany({ where: { id: instituteId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("walks every status in order and creates a mock BlockchainTransaction row", async () => {
    const observed: string[] = [];

    // Enqueue the job for the certificate row's Prisma id (cuid).
    await queue.add(CERTIFICATE_ISSUANCE_QUEUE, { certificateId: certId });

    const deadline = Date.now() + 15_000;
    let finalStatus = "";
    while (Date.now() < deadline) {
      const row = await prisma.certificate.findUnique({ where: { id: certId } });
      if (row && !observed.includes(row.status)) observed.push(row.status);
      if (row?.status === "COMPLETED") {
        finalStatus = row.status;
        break;
      }
      await new Promise((r) => setTimeout(r, 15));
    }

    // 1. Final status is COMPLETED.
    expect(finalStatus).toBe("COMPLETED");

    // 2. Every status in the state machine was observed, in order.
    expect(observed).toEqual([...EXPECTED_SEQUENCE]);

    // 3. A BlockchainTransaction row exists with the mock tx hash.
    const tx = await prisma.blockchainTransaction.findUnique({
      where: { certificateId: certId },
    });
    expect(tx).not.toBeNull();
    expect(tx!.status).toBe("CONFIRMED");
    expect(tx!.network).toBe("mock");
    expect(tx!.transactionHash).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
