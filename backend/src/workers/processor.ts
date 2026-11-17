import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import type { Job as BullJob } from "bullmq";
import { Job } from "../models/Job";
import { JobExecutionHistory } from "../models/JobExecutionHistory";
import { publishRealtime } from "../infra/realtime";

interface QueueForgeJobData {
  jobRecordId: string;
  userId: string;
  type: "send-email" | "generate-report";
  payload: Record<string, unknown>;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function processQueueForgeJob(bullJob: BullJob<QueueForgeJobData>): Promise<Record<string, unknown>> {
  const data = bullJob.data;
  if (!data?.jobRecordId || !data.userId || !data.payload) {
    throw new Error("Queue message is missing its job record, user, or payload");
  }

  const jobRecord = await Job.findByIdAndUpdate(data.jobRecordId, {
    $set: { status: "active", attemptsMade: bullJob.attemptsMade + 1, progress: 5 },
    $unset: { error: 1 }
  });
  if (!jobRecord) throw new Error(`Persisted job ${data.jobRecordId} was not found`);
  await JobExecutionHistory.create({
    jobId: new mongoose.Types.ObjectId(data.jobRecordId),
    workerId: process.env.WORKER_ID || undefined,
    attempt: bullJob.attemptsMade + 1,
    event: "started",
    message: "Worker started processing the job",
    details: { bullJobId: bullJob.id }
  });
  await publishRealtime("job:started", {
    jobId: data.jobRecordId,
    userId: data.userId,
    queueName: bullJob.queueName,
    type: data.type,
    attempt: bullJob.attemptsMade + 1,
    status: "active"
  });

  await bullJob.updateProgress(25);
  await Job.findByIdAndUpdate(data.jobRecordId, { $set: { progress: 25 } });
  await delay(200);

  let result: Record<string, unknown>;
  if (data.type === "send-email") {
    const to = String(data.payload.to);
    const subject = String(data.payload.subject);
    // This is a deterministic demo transport: it records a simulated delivery and does not send external email.
    result = {
      deliveryStatus: "simulated",
      messageId: randomUUID(),
      to,
      subject,
      acceptedAt: new Date().toISOString()
    };
  } else {
    const parameters = (data.payload.parameters ?? {}) as Record<string, unknown>;
    const rows = Array.isArray(parameters.rows) ? parameters.rows : [];
    const filters = Object.fromEntries(Object.entries(parameters).filter(([key]) => key !== "rows"));
    result = {
      reportId: randomUUID(),
      reportType: String(data.payload.reportType),
      format: "json",
      generatedAt: new Date().toISOString(),
      requestedBy: data.payload.requestedBy ?? null,
      filters,
      rows,
      summary: { status: "generated", recordCount: rows.length }
    };
  }

  await bullJob.updateProgress(90);
  await Job.findByIdAndUpdate(data.jobRecordId, { $set: { progress: 90 } });
  await delay(100);
  return result;
}

export async function handleJobCompleted(
  bullJob: BullJob<QueueForgeJobData>,
  result: Record<string, unknown>
): Promise<void> {
  await Job.findByIdAndUpdate(bullJob.data.jobRecordId, {
    $set: { status: "completed", progress: 100, result, completedAt: new Date(), attemptsMade: bullJob.attemptsMade + 1 },
    $unset: { error: 1 }
  });
  await JobExecutionHistory.create({
    jobId: new mongoose.Types.ObjectId(bullJob.data.jobRecordId),
    workerId: process.env.WORKER_ID || undefined,
    attempt: bullJob.attemptsMade + 1,
    event: "completed",
    message: "Job completed successfully",
    details: { result }
  });
  await publishRealtime("job:completed", {
    jobId: bullJob.data.jobRecordId,
    userId: bullJob.data.userId,
    queueName: bullJob.queueName,
    type: bullJob.data.type,
    status: "completed",
    result,
    completedAt: new Date().toISOString()
  });
}

export async function handleJobFailed(bullJob: BullJob<QueueForgeJobData>, error: Error): Promise<void> {
  const maxAttempts = bullJob.opts.attempts ?? 1;
  const queueState = await bullJob.getState().catch(() => "unknown");
  const isTerminal = queueState === "failed" || bullJob.attemptsMade >= maxAttempts;
  const status = isTerminal ? "failed" : "delayed";
  await Job.findByIdAndUpdate(bullJob.data.jobRecordId, {
    $set: { status, attemptsMade: bullJob.attemptsMade, error: error.message }
  });

  await JobExecutionHistory.create({
    jobId: new mongoose.Types.ObjectId(bullJob.data.jobRecordId),
    workerId: process.env.WORKER_ID || undefined,
    attempt: bullJob.attemptsMade,
    event: isTerminal ? "failed" : "retrying",
    message: isTerminal ? "Job exhausted its configured attempts" : "Job failed; BullMQ will retry with exponential backoff",
    details: { error: error.message, maxAttempts }
  });

  const event = isTerminal ? "job:failed" : "job:retrying";
  await publishRealtime(event, {
    jobId: bullJob.data.jobRecordId,
    userId: bullJob.data.userId,
    queueName: bullJob.queueName,
    type: bullJob.data.type,
    status,
    attempt: bullJob.attemptsMade,
    maxAttempts,
    error: error.message
  });

  if (isTerminal) {
    try {
      const { getQueue } = await import("../queues/queue-manager");
      await getQueue("dead-letter").add("dead-letter", {
        sourceQueue: bullJob.queueName,
        sourceBullJobId: bullJob.id,
        jobRecordId: bullJob.data.jobRecordId,
        userId: bullJob.data.userId,
        type: bullJob.data.type,
        payload: bullJob.data.payload,
        failedReason: error.message,
        attemptsMade: bullJob.attemptsMade,
        failedAt: new Date().toISOString()
      }, { attempts: 1, removeOnComplete: true, removeOnFail: false });
      await JobExecutionHistory.create({
        jobId: new mongoose.Types.ObjectId(bullJob.data.jobRecordId),
        workerId: process.env.WORKER_ID || undefined,
        attempt: bullJob.attemptsMade,
        event: "dead-lettered",
        message: "Terminally failed job copied to the dead-letter queue",
        details: { sourceQueue: bullJob.queueName, sourceBullJobId: bullJob.id }
      });
    } catch (deadLetterError) {
      console.error("Unable to move terminal job to dead-letter queue:", deadLetterError);
    }
  }
}
