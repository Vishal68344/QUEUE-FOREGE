import { Schema, model, models, type HydratedDocument, type Types } from "mongoose";

export type JobExecutionEvent = "created" | "started" | "retrying" | "completed" | "failed" | "cancelled" | "dead-lettered";

export interface IJobExecutionHistory {
  jobId: Types.ObjectId;
  workerId?: string;
  attempt: number;
  event: JobExecutionEvent;
  message?: string;
  details: Record<string, unknown>;
  createdAt?: Date;
}

const jobExecutionHistorySchema = new Schema<IJobExecutionHistory>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    workerId: { type: String },
    attempt: { type: Number, min: 0, default: 0 },
    event: {
      type: String,
      enum: ["created", "started", "retrying", "completed", "failed", "cancelled", "dead-lettered"],
      required: true
    },
    message: { type: String },
    details: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

jobExecutionHistorySchema.index({ jobId: 1, createdAt: -1 });

export type JobExecutionHistoryDocument = HydratedDocument<IJobExecutionHistory>;
export const JobExecutionHistory = (models.JobExecutionHistory as ReturnType<typeof model<IJobExecutionHistory>>) || model<IJobExecutionHistory>("JobExecutionHistory", jobExecutionHistorySchema);
