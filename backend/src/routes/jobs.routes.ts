import { Router } from "express";
import { z } from "zod";
import { JOB_STATUSES } from "../models/Job";
import { authenticate } from "../middleware/auth";
import * as jobService from "../services/job.service";
import { asyncHandler } from "../utils/async-handler";
import { success } from "../utils/api-response";
import { validateBody, validateParams, validateQuery } from "../utils/validation";

const router = Router();
router.use(authenticate);

const jobIdSchema = z.object({ id: z.string().min(1).max(100) });
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
const listJobsSchema = paginationSchema.extend({
  status: z.enum(JOB_STATUSES).optional(),
  queue: z.string().min(1).max(64).optional(),
  search: z.string().trim().min(1).max(100).optional()
});

const commonOptions = {
  metadata: z.record(z.unknown()).optional(),
  attempts: z.number().int().min(1).max(20).optional(),
  backoffMs: z.number().int().min(100).max(300000).optional()
};
const createJobSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("send-email"),
    payload: z.object({
      to: z.string().email(),
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(20000)
    }),
    ...commonOptions
  }),
  z.object({
    type: z.literal("generate-report"),
    payload: z.object({
      reportType: z.enum(["daily", "weekly", "monthly", "custom"]),
      parameters: z.record(z.unknown()).optional(),
      requestedBy: z.string().max(120).optional()
    }),
    ...commonOptions
  })
]);

router.get("/failed", validateQuery(paginationSchema), asyncHandler(async (req, res) => {
  const query = res.locals.validatedQuery as z.infer<typeof paginationSchema>;
  const result = await jobService.listFailedJobs(req.authUser!.id, query.page, query.limit);
  return success(res, result.items, 200, result.pagination);
}));

router.get("/", validateQuery(listJobsSchema), asyncHandler(async (req, res) => {
  const query = res.locals.validatedQuery as z.infer<typeof listJobsSchema>;
  const result = await jobService.listJobs(req.authUser!.id, query);
  return success(res, result.items, 200, result.pagination);
}));

router.post("/", validateBody(createJobSchema), asyncHandler(async (req, res) => {
  const job = await jobService.createJob(req.authUser!.id, req.body);
  return success(res, job, 201);
}));

router.get("/:id", validateParams(jobIdSchema), asyncHandler(async (req, res) => {
  const job = await jobService.getJobById(req.authUser!.id, (req.params.id as string));
  return success(res, job);
}));

router.post("/:id/retry", validateParams(jobIdSchema), asyncHandler(async (req, res) => {
  const job = await jobService.retryJob(req.authUser!.id, (req.params.id as string));
  return success(res, job, 202);
}));

router.post("/:id/cancel", validateParams(jobIdSchema), asyncHandler(async (req, res) => {
  const job = await jobService.cancelJob(req.authUser!.id, (req.params.id as string));
  return success(res, job);
}));

export default router;
