import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getDashboardStats } from "../services/queue.service";
import { asyncHandler } from "../utils/async-handler";
import { success } from "../utils/api-response";

const router = Router();
router.use(authenticate);
router.get("/stats", asyncHandler(async (_req, res) => success(res, await getDashboardStats())));
export default router;
