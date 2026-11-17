import mongoose from "mongoose";
import { Job, type JobStatus } from "../models/Job";
import { JobExecutionHistory } from "../models/JobExecutionHistory";
import { QueueConfiguration } from "../models/QueueConfiguration";
import { env } from "../config/env";
import { publishRealtime } from "../infra/realtime";
import { createQueueJobOptions, getQueue } from "../queues/queue-manager";
import { HttpError } from "../utils/http-error";

export interface CreateJobInput {
  type: "send-email" | "generate-report";
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  attempts?: number;
  backoffMs?: number;
}

export interface ListJobsInput {
  page: number;
  limit: number;
  status?: JobStatus;
  queue?: string;
  search?: string;
}

function queueForType(type: CreateJobInput["type"]): string {
  return type === "send-email" ? "emails" : "reports";
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function writeHistory(
  jobId: mongoose.Types.ObjectId,
  event: "created" | "retrying" | "cancelled" | "failed",
  message: string,
  details: Record<string, unknown> = {},
  attempt = 0
): Promise<void> {
  await JobExecutionHistory.create({ jobId, event, message, details, attempt });
}

export async function createJob(userId: string, input: CreateJobInput): Promise<Record<string, unknown>> {
  const queueName = queueForType(input.type);
  const queueConfig = await QueueConfiguration.findOne({ name: queueName }).lean();
  const maxAttempts = input.attempts ?? queueConfig?.defaultAttempts ?? env.QUEUE_DEFAULT_ATTEMPTS;
  const backoffMs = input.backoffMs ?? queueConfig?.backoffMs ?? env.QUEUE_DEFAULT_BACKOFF_MS;

  const record = await Job.create({
    userId: new mongoose.Types.ObjectId(userId),
    type: input.type,
    queueName,
    payload: input.payload,
    metadata: input.metadata ?? {},
    status: "waiting",
    attemptsMade: 0,
    maxAttempts,
    backoffMs,
    retryCount: 0,
    progress: 0
  });

  const bullJobId = `${record.id}-r0`;
  record.bullJobId = bullJobId;
  await record.save();
  await writeHistory(record._id, "created", "Job created and queued for submission", { queueName, bullJobId });
  await publishRealtime("job:created", {
    jobId: record.id,
    userId,
    queueName,
    type: input.type,
    status: record.status,
    createdAt: record.createdAt?.toISOString() ?? new Date().toISOString()
  });

  try {
    const queue = getQueue(queueName);
    await queue.add(
      input.type,
      { jobRecordId: record.id, type: input.type, payload: input.payload, userId },
      createQueueJobOptions(maxAttempts, backoffMs, bullJobId)
    );
  } catch (error) {
    record.status = "failed";
    record.error = error instanceof Error ? error.message : "Unable to enqueue job";
    await record.save();
    await writeHistory(record._id, "failed", "Queue submission failed before execution", { error: record.error });
    await publishRealtime("job:failed", {
      jobId: record.id,
      userId,
      queueName,
      type: input.type,
      status: "failed",
      error: record.error
    });
    throw new HttpError(503, "QUEUE_UNAVAILABLE", "The job could not be added to its queue");
  }

  return record.toObject() as unknown as Record<string, unknown>;
}

export async function listJobs(userId: string, input: ListJobsInput): Promise<{
  items: unknown[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const filter: Record<string, unknown> = { userId };
  if (input.status) filter.status = input.status;
  if (input.queue) filter.queueName = input.queue;
  if (input.search) {
    const expression = new RegExp(escapeRegex(input.search), "i");
    filter.$or = [{ type: expression }, { queueName: expression }, { "metadata.label": expression }];
  }
  const skip = (input.page - 1) * input.limit;
  const [items, total] = await Promise.all([
    Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(input.limit).lean(),
    Job.countDocuments(filter)
  ]);
  return {
    items,
    pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) }
  };
}

export async function getJobById(userId: string, jobId: string): Promise<Record<string, unknown>> {
  if (!mongoose.isValidObjectId(jobId)) throw new HttpError(400, "INVALID_JOB_ID", "The job ID is invalid");
  const job = await Job.findOne({ _id: jobId, userId }).lean();
  if (!job) throw new HttpError(404, "JOB_NOT_FOUND", "Job not found");
  const history = await JobExecutionHistory.find({ jobId: job._id }).sort({ createdAt: 1 }).lean();
  return { ...job, executionHistory: history };
}

export async function listFailedJobs(userId: string, page = 1, limit = 20): Promise<{
  items: unknown[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  return listJobs(userId, { page, limit, status: "failed" });
}

export async function retryJob(userId: string, jobId: string): Promise<Record<string, unknown>> {
  if (!mongoose.isValidObjectId(jobId)) throw new HttpError(400, "INVALID_JOB_ID", "The job ID is invalid");
  const previous = await Job.findOne({ _id: jobId, userId, status: "failed" });
  if (!previous) throw new HttpError(404, "FAILED_JOB_NOT_FOUND", "A failed job with this ID was not found");

  const retryCount = previous.retryCount + 1;
  const bullJobId = `${previous.id}-r${retryCount}`;
  const record = await Job.findOneAndUpdate(
    { _id: previous._id, userId, status: "failed", retryCount: previous.retryCount },
    {
      $set: {
        retryCount,
        bullJobId,
        status: "waiting",
        attemptsMade: 0,
        progress: 0
      },
      $unset: { error: 1, result: 1, completedAt: 1 }
    },
    { new: true }
  );
  if (!record) throw new HttpError(409, "RETRY_ALREADY_SUBMITTED", "Another retry was submitted for this job");

  await writeHistory(record._id, "retrying", "Manual retry is being submitted", { retryCount, bullJobId }, 0);
  await publishRealtime("job:retrying", {
    jobId: record.id,
    userId,
    queueName: record.queueName,
    retryCount,
    status: "waiting"
  });

  try {
    await getQueue(record.queueName).add(
      record.type,
      { jobRecordId: record.id, type: record.type, payload: record.payload, userId },
      createQueueJobOptions(record.maxAttempts, record.backoffMs, bullJobId)
    );
  } catch (error) {
    record.status = "failed";
    record.error = error instanceof Error ? error.message : "Retry submission failed";
    await record.save();
    await writeHistory(record._id, "failed", "Manual retry could not be submitted to the queue", { error: record.error, retryCount }, 0);
    await publishRealtime("job:failed", {
      jobId: record.id,
      userId,
      queueName: record.queueName,
      status: "failed",
      error: record.error
    });
    throw new HttpError(503, "QUEUE_UNAVAILABLE", "The failed job could not be retried");
  }

  return record.toObject() as unknown as Record<string, unknown>;
}

export async function cancelJob(userId: string, jobId: string): Promise<Record<string, unknown>> {
  if (!mongoose.isValidObjectId(jobId)) throw new HttpError(400, "INVALID_JOB_ID", "The job ID is invalid");
  const record = await Job.findOne({ _id: jobId, userId });
  if (!record) throw new HttpError(404, "JOB_NOT_FOUND", "Job not found");
  if (record.status !== "waiting" && record.status !== "delayed") {
    throw new HttpError(409, "JOB_NOT_CANCELLABLE", `A ${record.status} job cannot be cancelled`);
  }
  if (!record.bullJobId) throw new HttpError(409, "QUEUE_JOB_MISSING", "The queue job is no longer available");

  const bullJob = await getQueue(record.queueName).getJob(record.bullJobId);
  if (!bullJob) throw new HttpError(409, "QUEUE_JOB_MISSING", "The queue job is no longer available");
  const state = await bullJob.getState();
  if (!["waiting", "delayed", "paused"].includes(state)) {
    throw new HttpError(409, "JOB_NOT_CANCELLABLE", `A ${state} queue job cannot be cancelled`);
  }
  try {
    await bullJob.remove();
  } catch {
    throw new HttpError(409, "JOB_NOT_CANCELLABLE", "The job started before it could be cancelled");
  }

  record.status = "cancelled";
  await record.save();
  await writeHistory(record._id, "cancelled", "Job cancelled before execution", { previousState: state });
  await publishRealtime("job:cancelled", { jobId: record.id, userId, queueName: record.queueName, status: "cancelled" });
  return record.toObject() as unknown as Record<string, unknown>;
}
