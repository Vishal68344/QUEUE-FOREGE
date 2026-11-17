import { Queue, type JobsOptions } from "bullmq";
import { QUEUE_NAMES } from "../config/constants";
import { env } from "../config/env";
import { getSharedRedis } from "../infra/redis";
import { HttpError } from "../utils/http-error";

const queues = new Map<string, Queue>();

export function isSupportedQueueName(name: string): boolean {
  return (QUEUE_NAMES as readonly string[]).includes(name);
}

export function assertSupportedQueueName(name: string): void {
  if (!isSupportedQueueName(name)) {
    throw new HttpError(404, "QUEUE_NOT_FOUND", `Queue '${name}' is not configured`);
  }
}

export function getQueue(name: string): Queue {
  assertSupportedQueueName(name);
  const existing = queues.get(name);
  if (existing) return existing;
  const queue = new Queue(name, { connection: getSharedRedis() });
  queues.set(name, queue);
  return queue;
}

export function createQueueJobOptions(attempts: number, backoffMs: number, jobId: string): JobsOptions {
  return {
    jobId,
    attempts,
    backoff: { type: "exponential", delay: backoffMs },
    removeOnComplete: env.QUEUE_REMOVE_ON_COMPLETE,
    removeOnFail: false
  };
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();
}
