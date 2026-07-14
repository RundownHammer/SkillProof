import { describe, it, expect, afterEach } from "vitest";
import type { Queue, Worker } from "bullmq";
import {
  createCertificateIssuanceQueue,
  createCertificateIssuanceWorker,
  CERTIFICATE_ISSUANCE_QUEUE,
  type CertificateIssuanceJobData,
} from "../src/index.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const connection = { url: redisUrl, maxRetriesPerRequest: null } as const;

const created: Array<Queue | Worker> = [];

afterEach(async () => {
  for (const resource of created) {
    if ("obliterate" in resource) {
      await (resource as Queue).obliterate({ force: true }).catch(() => {});
    }
    await resource.close().catch(() => {});
  }
  created.length = 0;
});

describe("certificate-issuance queue plumbing", () => {
  it("enqueues a job and the worker consumes it with the same payload", async () => {
    const queue = createCertificateIssuanceQueue(connection);
    created.push(queue);

    const received = new Promise<CertificateIssuanceJobData>((resolve, reject) => {
      const worker = createCertificateIssuanceWorker(async (job) => {
        resolve(job.data);
      }, connection);
      created.push(worker);
      worker.on("failed", (job, err) => reject(err ?? new Error(`job ${job?.id} failed`)));
    });

    await queue.waitUntilReady();
    await queue.add(CERTIFICATE_ISSUANCE_QUEUE, { certificateId: "test-cuid-123" });

    const data = await Promise.race([
      received,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timed out waiting for job consumption")), 10_000),
      ),
    ]);

    expect(data).toEqual({ certificateId: "test-cuid-123" });
  });
});
