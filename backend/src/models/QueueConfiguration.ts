import { Schema, model, models, type HydratedDocument, type Model } from "mongoose";

export interface IQueueConfiguration {
  name: string;
  isPaused: boolean;
  defaultAttempts: number;
  backoffMs: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const queueConfigurationSchema = new Schema<IQueueConfiguration>(
  {
    name: { type: String, required: true, unique: true },
    isPaused: { type: Boolean, default: false },
    defaultAttempts: { type: Number, min: 1, default: 3 },
    backoffMs: { type: Number, min: 100, default: 1000 }
  },
  { timestamps: true, versionKey: false }
);

export type QueueConfigurationDocument = HydratedDocument<IQueueConfiguration>;
export const QueueConfiguration: Model<IQueueConfiguration> = (models.QueueConfiguration as Model<IQueueConfiguration> | undefined) ?? model<IQueueConfiguration>("QueueConfiguration", queueConfigurationSchema);
