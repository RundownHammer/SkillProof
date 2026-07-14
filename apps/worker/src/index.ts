import "dotenv/config";
import { createCertificateIssuanceWorker } from "@credential/queue";
import { processIssuance } from "./processor.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const connection = { url: redisUrl, maxRetriesPerRequest: null };

const worker = createCertificateIssuanceWorker(processIssuance, connection);

worker.on("ready", () => {
  console.log("worker ready");
});

worker.on("completed", (job) => {
  console.log(`[issuance] job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[issuance] job ${job?.id} failed:`, err);
});

worker.on("error", (error) => {
  console.error("worker error:", error);
});

async function bootstrap(): Promise<void> {
  await worker.waitUntilReady();
  console.log(`connected to Redis at ${redisUrl}`);
}

bootstrap().catch((error: unknown) => {
  console.error("failed to start worker:", error);
  process.exit(1);
});
