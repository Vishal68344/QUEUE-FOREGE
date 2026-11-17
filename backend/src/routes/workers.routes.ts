import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { listWorkers } from "../services/queue.service";
import { asyncHandler } from "../utils/async-handler";
import { success } from "../utils/api-response";

const router = Router();
router.use(authenticate);
router.get("/", asyncHandler(async (_req, res) => success(res, await listWorkers())));
export default router;
