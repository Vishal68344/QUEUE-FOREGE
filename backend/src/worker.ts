import os from "node:os";
import { randomUUID } from "node:crypto";
import { Worker as BullWorker, type Job as BullJob } from "bullmq";
import { env } from "./config/env";
import { connectMongo, disconnectMongo } from "./db/mongoose";
import { createRedisConnection, setSharedRedis, closeSharedRedis } from "./infra/redis";
import { publishRealtime } from "./infra/realtime";
import { Worker as WorkerModel } from "./models/Worker";
import { QUEUE_NAMES } from "./config/constants";
import {
  processQueueForgeJob,
  handleJobCompleted,
  handleJobFailed
} from "./workers/processor";

interface QueueForgeJobData {
  jobRecordId: string;
  userId: string;
  type: "send-email" | "generate-report";
  payload: Record<string, unknown>;
}

const workerId = env.WORKER_ID || `${os.hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
process.env.WORKER_ID = workerId;
const activeWorkers: BullWorker<QueueForgeJobData>[] = [];
let heartbeat: NodeJS.Timeout | undefined;
let redisConnection: ReturnType<typeof createRedisConnection> | undefined;
let shuttingDown = false;

async function registerWorker(): Promise<void> {
  const now = new Date();
  await WorkerModel.findOneAndUpdate(
    { workerId },
    {
      $set: {
        hostname: os.hostname(),
        pid: process.pid,
        queues: ["emails", "reports"],
        status: "online",
        lastHeartbeatAt: now,
        metadata: { nodeVersion: process.version, platform: process.platform }
      },
      $setOnInsert: { startedAt: now }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await publishRealtime("worker:status", { workerId, hostname: os.hostname(), status: "online", queues: ["emails", "reports"] });
}

async function heartbeatWorker(): Promise<void> {
  const previous = await WorkerModel.findOneAndUpdate(
    { workerId },
    { $set: { status: "online", lastHeartbeatAt: new Date() } },
    { new: false }
  ).select("status");
  if (!previous) {
    await registerWorker();
  } else if (previous.status !== "online") {
    await publishRealtime("worker:status", { workerId, hostname: os.hostname(), status: "online", queues: ["emails", "reports"] });
  }
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Worker ${workerId} received ${signal}; shutting down`);
  if (heartbeat) clearInterval(heartbeat);
  const workerClosures = await Promise.allSettled(activeWorkers.map((worker) => worker.close()));
  workerClosures.filter((result) => result.status === "rejected").forEach((result) => {
    if (result.status === "rejected") console.error("Worker close failed:", result.reason);
  });
  try {
    await WorkerModel.updateOne({ workerId }, { $set: { status: "offline", lastHeartbeatAt: new Date() } });
    await publishRealtime("worker:status", { workerId, hostname: os.hostname(), status: "offline", queues: ["emails", "reports"] });
  } finally {
    await closeSharedRedis();
    await disconnectMongo();
  }
}

async function start(): Promise<void> {
  await connectMongo();
  redisConnection = createRedisConnection(`queueforge-worker-${workerId}`);
  setSharedRedis(redisConnection);
  await redisConnection.ping();
  await registerWorker();

  for (const queueName of QUEUE_NAMES.filter((name) => name !== "dead-letter")) {
    const worker = new BullWorker<QueueForgeJobData>(queueName, processQueueForgeJob, {
      connection: redisConnection.duplicate({ connectionName: `queueforge-${queueName}-${workerId}` }),
      concurrency: env.WORKER_CONCURRENCY
    });
    worker.on("completed", (job: BullJob<QueueForgeJobData>, result: Record<string, unknown>) => {
      void handleJobCompleted(job, result).catch((error: unknown) => console.error("Unable to record completed job:", error));
    });
    worker.on("failed", (job: BullJob<QueueForgeJobData> | undefined, error: Error) => {
      if (job) void handleJobFailed(job, error).catch((handlerError: unknown) => console.error("Unable to record job failure:", handlerError));
    });
    worker.on("error", (error: Error) => console.error(`Worker queue ${queueName} error:`, error));
    activeWorkers.push(worker);
  }

  heartbeat = setInterval(() => {
    void heartbeatWorker().catch((error: unknown) => console.error("Worker heartbeat failed:", error));
  }, env.WORKER_HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();
  console.info(`QueueForge worker ${workerId} listening on emails and reports (concurrency ${env.WORKER_CONCURRENCY})`);
}

process.once("SIGINT", () => void shutdown("SIGINT").then(() => process.exit(0)));
process.once("SIGTERM", () => void shutdown("SIGTERM").then(() => process.exit(0)));

start().catch(async (error: unknown) => {
  console.error("Worker failed to start:", error);
  if (redisConnection) await closeSharedRedis().catch(() => undefined);
  await disconnectMongo().catch(() => undefined);
  process.exitCode = 1;
});
