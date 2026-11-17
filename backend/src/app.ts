import express from "express";
import cors from "cors";
import helmet from "helmet";
import { allowedOrigins } from "./config/env";
import authRoutes from "./routes/auth.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import healthRoutes from "./routes/health.routes";
import jobsRoutes from "./routes/jobs.routes";
import queuesRoutes from "./routes/queues.routes";
import workersRoutes from "./routes/workers.routes";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
    credentials: true
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  app.use("/api/health", healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/jobs", jobsRoutes);
  app.use("/api/queues", queuesRoutes);
  app.use("/api/workers", workersRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
