import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { User } from "../src/models/User";
import { HttpError } from "../src/utils/http-error";
import * as healthService from "../src/services/health.service";
import * as authService from "../src/services/auth.service";
import * as jobService from "../src/services/job.service";
import * as queueService from "../src/services/queue.service";

vi.mock("../src/models/User", () => ({ User: { findById: vi.fn() } }));
vi.mock("../src/infra/redis", () => ({
  getSharedRedis: vi.fn(() => ({ ping: vi.fn().mockResolvedValue("PONG") }))
}));
vi.mock("../src/services/health.service", () => ({ getHealth: vi.fn() }));
vi.mock("../src/services/auth.service", () => ({ register: vi.fn(), login: vi.fn() }));
vi.mock("../src/services/job.service", () => ({
  createJob: vi.fn(),
  listJobs: vi.fn(),
  getJobById: vi.fn(),
  listFailedJobs: vi.fn(),
  retryJob: vi.fn(),
  cancelJob: vi.fn()
}));
vi.mock("../src/services/queue.service", () => ({
  listQueues: vi.fn(),
  pauseQueue: vi.fn(),
  resumeQueue: vi.fn(),
  listWorkers: vi.fn(),
  getDashboardStats: vi.fn()
}));

const app = createApp();
const token = jwt.sign({ sub: "507f1f77bcf86cd799439011" }, env.JWT_SECRET, { expiresIn: "1h" });
const authHeader = { Authorization: `Bearer ${token}` };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/health", () => {
  it("returns 200 when MongoDB and Redis are healthy", async () => {
    vi.mocked(healthService.getHealth).mockResolvedValue({
      status: "ok",
      timestamp: "2026-11-17T00:00:00.000Z",
      services: { mongodb: "connected", redis: "connected" }
    });
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.services.redis).toBe("connected");
  });

  it("returns 503 when a dependency is unhealthy", async () => {
    vi.mocked(healthService.getHealth).mockResolvedValue({
      status: "degraded",
      timestamp: "2026-11-17T00:00:00.000Z",
      services: { mongodb: "disconnected", redis: "connected" }
    });
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(503);
  });
});

describe("authentication", () => {
  it("registers an account and returns a JWT", async () => {
    vi.mocked(authService.register).mockResolvedValue({
      user: { id: "u1", email: "dev@example.com", createdAt: new Date("2026-01-01") },
      accessToken: "signed-token"
    });
    const response = await request(app).post("/api/auth/register").send({ email: "dev@example.com", password: "strong-pass-123" });
    expect(response.status).toBe(201);
    expect(response.body.data.accessToken).toBe("signed-token");
  });

  it("logs in and returns a JWT", async () => {
    vi.mocked(authService.login).mockResolvedValue({
      user: { id: "u1", email: "dev@example.com", createdAt: new Date("2026-01-01") },
      accessToken: "login-token"
    });
    const response = await request(app).post("/api/auth/login").send({ email: "dev@example.com", password: "strong-pass-123" });
    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBe("login-token");
  });

  it("rejects invalid credentials during login validation", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: "not-an-email", password: "short" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(authService.login).not.toHaveBeenCalled();
  });

  it("rejects protected requests without a bearer token", async () => {
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("accepts a valid JWT when the user still exists", async () => {
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue({ id: "507f1f77bcf86cd799439011", email: "dev@example.com" })
    } as never);
    const response = await request(app).get("/api/auth/me").set(authHeader);
    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe("dev@example.com");
  });
});

describe("job endpoints", () => {
  it("creates a valid send-email job", async () => {
    vi.mocked(jobService.createJob).mockResolvedValue({ id: "job-1", status: "waiting", type: "send-email" });
    const response = await request(app).post("/api/jobs").set(authHeader).send({
      type: "send-email",
      payload: { to: "user@example.com", subject: "Welcome", body: "Hello" }
    });
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("waiting");
  });

  it("validates job payloads and does not enqueue invalid jobs", async () => {
    const response = await request(app).post("/api/jobs").set(authHeader).send({ type: "send-email", payload: { to: "bad-email" } });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(jobService.createJob).not.toHaveBeenCalled();
  });

  it("lists jobs with pagination metadata", async () => {
    vi.mocked(jobService.listJobs).mockResolvedValue({
      items: [{ id: "job-1", status: "waiting" }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
    });
    const response = await request(app).get("/api/jobs?page=1&limit=20").set(authHeader);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.total).toBe(1);
  });

  it("retrieves a job and its execution history", async () => {
    vi.mocked(jobService.getJobById).mockResolvedValue({ id: "job-1", executionHistory: [{ event: "created" }] });
    const response = await request(app).get("/api/jobs/job-1").set(authHeader);
    expect(response.status).toBe(200);
    expect(response.body.data.executionHistory).toHaveLength(1);
  });

  it("returns a consistent invalid-request response", async () => {
    vi.mocked(jobService.getJobById).mockRejectedValue(new HttpError(400, "INVALID_JOB_ID", "The job ID is invalid"));
    const response = await request(app).get("/api/jobs/not-an-object-id").set(authHeader);
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("INVALID_JOB_ID");
  });

  it("lists failed jobs separately", async () => {
    vi.mocked(jobService.listFailedJobs).mockResolvedValue({
      items: [{ id: "job-2", status: "failed" }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
    });
    const response = await request(app).get("/api/jobs/failed").set(authHeader);
    expect(response.status).toBe(200);
    expect(response.body.data[0].status).toBe("failed");
  });

  it("submits a retry for a failed job", async () => {
    vi.mocked(jobService.retryJob).mockResolvedValue({ id: "job-3", status: "waiting", retryCount: 1 });
    const response = await request(app).post("/api/jobs/job-3/retry").set(authHeader);
    expect(response.status).toBe(202);
    expect(response.body.data.retryCount).toBe(1);
  });

  it("cancels a waiting job", async () => {
    vi.mocked(jobService.cancelJob).mockResolvedValue({ id: "job-4", status: "cancelled" });
    const response = await request(app).post("/api/jobs/job-4/cancel").set(authHeader);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("cancelled");
  });
});

describe("queue operations", () => {
  it("lists queue statistics", async () => {
    vi.mocked(queueService.listQueues).mockResolvedValue([{ name: "emails", isPaused: false, counts: { waiting: 2 } }]);
    const response = await request(app).get("/api/queues").set(authHeader);
    expect(response.status).toBe(200);
    expect(response.body.data[0].name).toBe("emails");
  });

  it("pauses and resumes a queue", async () => {
    vi.mocked(queueService.pauseQueue).mockResolvedValue({ name: "emails", isPaused: true });
    vi.mocked(queueService.resumeQueue).mockResolvedValue({ name: "emails", isPaused: false });
    const paused = await request(app).post("/api/queues/emails/pause").set(authHeader);
    const resumed = await request(app).post("/api/queues/emails/resume").set(authHeader);
    expect(paused.status).toBe(200);
    expect(paused.body.data.isPaused).toBe(true);
    expect(resumed.body.data.isPaused).toBe(false);
  });

  it("rejects malformed queue names", async () => {
    const response = await request(app).post("/api/queues/Bad%20Queue/pause").set(authHeader);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
