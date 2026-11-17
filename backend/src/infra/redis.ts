import Redis, { type RedisOptions } from "ioredis";
import { env } from "../config/env";

let sharedConnection: Redis | null = null;

export function createRedisConnection(connectionName = "queueforge"): Redis {
  const options: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectionName,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5000)
  };

  const connection = env.REDIS_URL
    ? new Redis(env.REDIS_URL, options)
    : new Redis({
        ...options,
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        username: env.REDIS_USERNAME || undefined,
        password: env.REDIS_PASSWORD || undefined,
        db: env.REDIS_DB,
        tls: env.REDIS_TLS ? {} : undefined
      });
  connection.on("error", (error) => console.error(`Redis connection '${connectionName}' error:`, error));
  return connection;
}

export function setSharedRedis(connection: Redis): void {
  sharedConnection = connection;
}

export function getSharedRedis(): Redis {
  if (!sharedConnection) throw new Error("Redis has not been initialized. Call setSharedRedis first.");
  return sharedConnection;
}

export async function closeSharedRedis(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = null;
  }
}
