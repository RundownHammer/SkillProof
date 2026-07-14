import { Queue, Worker, type ConnectionOptions, type Job } from "bullmq";

/**
 * Name of the real certificate-issuance queue.
 * MUST stay exactly "certificate-issuance" — apps/api enqueues and
 * apps/worker consumes by this constant.
 */
export const CERTIFICATE_ISSUANCE_QUEUE = "certificate-issuance";

/**
 * Payload for a certificate-issuance job.
 *
 * `certificateId` is the Certificate row's Prisma `id` (a cuid) — NOT the
 * human-readable `CERT-2026-XXXX` string. The worker re-fetches the row from
 * Postgres by this id; job payload fields are never treated as authoritative.
 */
export interface CertificateIssuanceJobData {
  certificateId: string;
}

export type CertificateIssuanceJob = Job<CertificateIssuanceJobData>;

export type CertificateIssuanceProcessor = (
  job: CertificateIssuanceJob,
) => Promise<void>;

/**
 * Create the certificate-issuance queue.
 *
 * The connection is supplied by the caller (apps/api / apps/worker) from
 * their own already-validated env — this package never reads process.env.
 */
export function createCertificateIssuanceQueue(
  connection: ConnectionOptions,
): Queue<CertificateIssuanceJobData> {
  return new Queue<CertificateIssuanceJobData>(CERTIFICATE_ISSUANCE_QUEUE, {
    connection,
  });
}

/**
 * Create a worker that consumes certificate-issuance jobs.
 *
 * The processor and connection are supplied by the caller; this factory only
 * pins the queue name and job-data type so api and worker stay in sync.
 */
export function createCertificateIssuanceWorker(
  processor: CertificateIssuanceProcessor,
  connection: ConnectionOptions,
): Worker<CertificateIssuanceJobData> {
  return new Worker<CertificateIssuanceJobData>(
    CERTIFICATE_ISSUANCE_QUEUE,
    processor,
    { connection },
  );
}
