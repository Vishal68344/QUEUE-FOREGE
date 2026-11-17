import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env";
import { authenticate } from "../middleware/auth";
import * as authService from "../services/auth.service";
import { asyncHandler } from "../utils/async-handler";
import { success } from "../utils/api-response";
import { validateBody } from "../utils/validation";

const router = Router();
const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many authentication requests" } }
});

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128)
});

router.post("/register", authLimiter, validateBody(credentialsSchema), asyncHandler(async (req, res) => {
  const result = await authService.register(req.body.email, req.body.password);
  return success(res, result, 201);
}));

router.post("/login", authLimiter, validateBody(credentialsSchema), asyncHandler(async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password);
  return success(res, result);
}));

router.get("/me", authenticate, (req, res) => success(res, req.authUser));

export default router;
