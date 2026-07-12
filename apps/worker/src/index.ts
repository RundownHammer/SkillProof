import "dotenv/config";
import { Queue, Worker } from "bullmq";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const connection = {
  url: redisUrl,
  maxRetriesPerRequest: null,
};

const PLACEHOLDER_QUEUE = "placeholder";

const queue = new Queue(PLACEHOLDER_QUEUE, { connection });
const worker = new Worker(
  PLACEHOLDER_QUEUE,
  async (job) => {
    console.log(`placeholder job received: ${job.id}`);
  },
  { connection },
);

worker.on("ready", () => {
  console.log("worker ready");
});

worker.on("error", (error) => {
  console.error("worker error:", error);
});

async function bootstrap(): Promise<void> {
  await queue.waitUntilReady();
  await worker.waitUntilReady();
  console.log(`connected to Redis at ${redisUrl}`);
}

bootstrap().catch((error: unknown) => {
  console.error("failed to start worker:", error);
  process.exit(1);
});
