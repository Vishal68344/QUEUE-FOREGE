import { Schema, model, models, type HydratedDocument } from "mongoose";

export type WorkerStatus = "online" | "offline" | "degraded";

export interface IWorker {
  workerId: string;
  hostname: string;
  pid: number;
  queues: string[];
  status: WorkerStatus;
  metadata: Record<string, unknown>;
  startedAt: Date;
  lastHeartbeatAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const workerSchema = new Schema<IWorker>(
  {
    workerId: { type: String, required: true, unique: true },
    hostname: { type: String, required: true },
    pid: { type: Number, required: true },
    queues: { type: [String], default: [] },
    status: { type: String, enum: ["online", "offline", "degraded"], default: "online", index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    startedAt: { type: Date, required: true },
    lastHeartbeatAt: { type: Date, required: true, index: true }
  },
  { timestamps: true, versionKey: false }
);

export type WorkerDocument = HydratedDocument<IWorker>;
export const Worker = (models.Worker as ReturnType<typeof model<IWorker>>) || model<IWorker>("Worker", workerSchema);
