import { Schema, model, models, type HydratedDocument, type Types } from "mongoose";
import type { JobType } from "../config/constants";

export const JOB_STATUSES = ["waiting", "active", "completed", "failed", "delayed", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface IJob {
  userId: Types.ObjectId;
  bullJobId?: string;
  type: JobType;
  queueName: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: JobStatus;
  attemptsMade: number;
  maxAttempts: number;
  backoffMs: number;
  retryCount: number;
  progress: number;
  result?: Record<string, unknown>;
  error?: string;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const jobSchema = new Schema<IJob>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    bullJobId: { type: String, index: true, sparse: true },
    type: { type: String, enum: ["send-email", "generate-report"], required: true },
    queueName: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: JOB_STATUSES, default: "waiting", index: true },
    attemptsMade: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, required: true, min: 1 },
    backoffMs: { type: Number, required: true, min: 100 },
    retryCount: { type: Number, default: 0, min: 0 },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    result: { type: Schema.Types.Mixed },
    error: { type: String },
    completedAt: { type: Date }
  },
  { timestamps: true, versionKey: false }
);

jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ userId: 1, createdAt: -1 });
jobSchema.index({ queueName: 1, createdAt: -1 });

export type JobDocument = HydratedDocument<IJob>;
export const Job = (models.Job as ReturnType<typeof model<IJob>>) || model<IJob>("Job", jobSchema);
