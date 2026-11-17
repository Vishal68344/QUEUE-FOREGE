import { createServer } from "node:http";
import { env } from "./config/env";
import { createApp } from "./app";
import { connectMongo, disconnectMongo } from "./db/mongoose";
import { closeQueues } from "./queues/queue-manager";
import { createRedisConnection, setSharedRedis, closeSharedRedis } from "./infra/redis";
import { createSocketServer, startRealtimeBridge } from "./infra/realtime";
import { markStaleWorkersOffline } from "./services/queue.service";

async function startServer(): Promise<void> {
  await connectMongo();
  const redis = createRedisConnection("queueforge-api");
  setSharedRedis(redis);
  await redis.ping();

  const server = createServer(createApp());
  const io = createSocketServer(server);
  const stopRealtimeBridge = await startRealtimeBridge();
  const workerHealthMonitor = setInterval(() => {
    void markStaleWorkersOffline().catch((error: unknown) => console.error("Worker health monitor failed:", error));
  }, Math.max(5000, Math.floor(env.WORKER_STALE_AFTER_MS / 2)));
  workerHealthMonitor.unref();

  server.listen(env.PORT, () => {
    console.info(`QueueForge API listening on port ${env.PORT}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(workerHealthMonitor);
    console.info(`API received ${signal}; shutting down`);
    io.close(async () => {
      await stopRealtimeBridge();
      await closeQueues();
      await closeSharedRedis();
      await disconnectMongo();
      process.exit(0);
    });
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

startServer().catch(async (error: unknown) => {
  console.error("QueueForge API failed to start:", error);
  await closeSharedRedis().catch(() => undefined);
  await disconnectMongo().catch(() => undefined);
  process.exitCode = 1;
});
