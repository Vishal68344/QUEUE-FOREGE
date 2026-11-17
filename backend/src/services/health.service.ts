import mongoose from "mongoose";
import type Redis from "ioredis";

export async function getHealth(redis: Redis): Promise<{
  status: "ok" | "degraded";
  timestamp: string;
  services: { mongodb: "connected" | "disconnected"; redis: "connected" | "disconnected" };
}> {
  const mongodb = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  let redisStatus: "connected" | "disconnected" = "disconnected";
  try {
    await redis.ping();
    redisStatus = "connected";
  } catch {
    redisStatus = "disconnected";
  }
  return {
    status: mongodb === "connected" && redisStatus === "connected" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    services: { mongodb, redis: redisStatus }
  };
}
