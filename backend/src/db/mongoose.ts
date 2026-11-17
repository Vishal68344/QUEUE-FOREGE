import mongoose from "mongoose";
import { env } from "../config/env";

export async function connectMongo(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: true
  });
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
