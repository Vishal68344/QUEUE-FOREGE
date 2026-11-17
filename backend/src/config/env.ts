import "dotenv/config";
import { z } from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "string") return value.toLowerCase() === "true";
  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  REDIS_URL: z.string().optional().default(""),
  REDIS_HOST: z.string().default("redis"),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_USERNAME: z.string().optional().default(""),
  REDIS_PASSWORD: z.string().optional().default(""),
  REDIS_DB: z.coerce.number().int().min(0).default(0),
  REDIS_TLS: booleanFromEnv.default(false),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must contain at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("1h"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  QUEUE_DEFAULT_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(3),
  QUEUE_DEFAULT_BACKOFF_MS: z.coerce.number().int().min(100).max(300000).default(1000),
  QUEUE_REMOVE_ON_COMPLETE: z.coerce.number().int().min(0).default(500),
  WORKER_ID: z.string().optional().default(""),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1000).default(10000),
  WORKER_STALE_AFTER_MS: z.coerce.number().int().min(1000).default(30000),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(30),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsed.data;
export const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
