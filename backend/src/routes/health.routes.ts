import { Router } from "express";
import { getSharedRedis } from "../infra/redis";
import { getHealth } from "../services/health.service";
import { asyncHandler } from "../utils/async-handler";
import { success } from "../utils/api-response";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => {
  const health = await getHealth(getSharedRedis());
  return success(res, health, health.status === "ok" ? 200 : 503);
}));

export default router;
