import { QUEUE_NAMES } from "../config/constants";
import { env } from "../config/env";
import { QueueConfiguration } from "../models/QueueConfiguration";
import { Worker } from "../models/Worker";
import { Job } from "../models/Job";
import { publishRealtime } from "../infra/realtime";
import { getQueue } from "../queues/queue-manager";

export async function listQueues(): Promise<Array<Record<string, unknown>>> {
  const result: Array<Record<string, unknown>> = [];
  for (const name of QUEUE_NAMES) {
    const queue = getQueue(name);
    const config = await QueueConfiguration.findOneAndUpdate(
      { name },
      { $setOnInsert: { name, defaultAttempts: env.QUEUE_DEFAULT_ATTEMPTS, backoffMs: env.QUEUE_DEFAULT_BACKOFF_MS } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const counts = await queue.getJobCounts("wait", "active", "completed", "failed", "delayed", "paused");
    const isPaused = await queue.isPaused();
    result.push({
      name,
      isPaused,
      defaultAttempts: config?.defaultAttempts ?? env.QUEUE_DEFAULT_ATTEMPTS,
      backoffMs: config?.backoffMs ?? env.QUEUE_DEFAULT_BACKOFF_MS,
      counts: {
        waiting: counts.wait ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
        paused: counts.paused ?? 0
      },
      total: Object.values(counts).reduce((sum, value) => sum + value, 0)
    });
  }
  return result;
}

export async function pauseQueue(name: string): Promise<{ name: string; isPaused: boolean }> {
  const queue = getQueue(name);
  await queue.pause();
  await QueueConfiguration.findOneAndUpdate(
    { name },
    { $set: { isPaused: true }, $setOnInsert: { defaultAttempts: env.QUEUE_DEFAULT_ATTEMPTS, backoffMs: env.QUEUE_DEFAULT_BACKOFF_MS } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await publishRealtime("queue:status", { queueName: name, isPaused: true, changedAt: new Date().toISOString() });
  return { name, isPaused: true };
}

export async function resumeQueue(name: string): Promise<{ name: string; isPaused: boolean }> {
  const queue = getQueue(name);
  await queue.resume();
  await QueueConfiguration.findOneAndUpdate(
    { name },
    { $set: { isPaused: false }, $setOnInsert: { defaultAttempts: env.QUEUE_DEFAULT_ATTEMPTS, backoffMs: env.QUEUE_DEFAULT_BACKOFF_MS } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await publishRealtime("queue:status", { queueName: name, isPaused: false, changedAt: new Date().toISOString() });
  return { name, isPaused: false };
}

export async function markStaleWorkersOffline(): Promise<void> {
  const staleBefore = new Date(Date.now() - env.WORKER_STALE_AFTER_MS);
  const staleWorkers = await Worker.find({
    status: { $ne: "offline" },
    lastHeartbeatAt: { $lt: staleBefore }
  }).select("workerId hostname").lean();

  if (staleWorkers.length === 0) return;
  await Promise.all(staleWorkers.map(async (worker) => {
    const changed = await Worker.findOneAndUpdate(
      {
        workerId: worker.workerId,
        status: { $ne: "offline" },
        lastHeartbeatAt: { $lt: staleBefore }
      },
      { $set: { status: "offline" } },
      { new: false }
    );
    if (changed) {
      await publishRealtime("worker:status", {
        workerId: worker.workerId,
        hostname: worker.hostname,
        status: "offline",
        reason: "heartbeat-timeout"
      });
    }
  }));
}

export async function listWorkers(): Promise<unknown[]> {
  await markStaleWorkersOffline();
  return Worker.find().sort({ lastHeartbeatAt: -1 }).lean();
}

export async function getDashboardStats(): Promise<Record<string, unknown>> {
  await markStaleWorkersOffline();
  const [jobGroups, workersOnline, workersTotal, queues] = await Promise.all([
    Job.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    Worker.countDocuments({ status: "online", lastHeartbeatAt: { $gte: new Date(Date.now() - env.WORKER_STALE_AFTER_MS) } }),
    Worker.countDocuments(),
    listQueues()
  ]);
  const jobsByStatus = Object.fromEntries(jobGroups.map((entry) => [entry._id, entry.count]));
  const totalJobs = jobGroups.reduce((sum, entry) => sum + entry.count, 0);
  return {
    jobs: {
      total: totalJobs,
      waiting: jobsByStatus.waiting ?? 0,
      active: jobsByStatus.active ?? 0,
      completed: jobsByStatus.completed ?? 0,
      failed: jobsByStatus.failed ?? 0,
      delayed: jobsByStatus.delayed ?? 0,
      cancelled: jobsByStatus.cancelled ?? 0
    },
    workers: { online: workersOnline, offline: Math.max(workersTotal - workersOnline, 0), total: workersTotal },
    queues
  };
}

