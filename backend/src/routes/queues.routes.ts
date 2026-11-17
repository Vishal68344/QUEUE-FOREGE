import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import * as queueService from "../services/queue.service";
import { asyncHandler } from "../utils/async-handler";
import { success } from "../utils/api-response";
import { validateParams } from "../utils/validation";

const router = Router();
router.use(authenticate);
const queueNameSchema = z.object({ name: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/) });

router.get("/", asyncHandler(async (_req, res) => success(res, await queueService.listQueues())));

router.post("/:name/pause", validateParams(queueNameSchema), asyncHandler(async (req, res) => {
  return success(res, await queueService.pauseQueue(req.params.name));
}));

router.post("/:name/resume", validateParams(queueNameSchema), asyncHandler(async (req, res) => {
  return success(res, await queueService.resumeQueue(req.params.name));
}));

export default router;
