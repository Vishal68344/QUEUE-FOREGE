import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";
import { HttpError } from "./http-error";

export const validateBody = (schema: ZodTypeAny): RequestHandler => (req, _res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return next(new HttpError(400, "VALIDATION_ERROR", "Request body is invalid", parsed.error.flatten()));
  req.body = parsed.data;
  next();
};

export const validateQuery = (schema: ZodTypeAny): RequestHandler => (req, res, next) => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return next(new HttpError(400, "VALIDATION_ERROR", "Query parameters are invalid", parsed.error.flatten()));
  res.locals.validatedQuery = parsed.data;
  next();
};

export const validateParams = (schema: ZodTypeAny): RequestHandler => (req, _res, next) => {
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) return next(new HttpError(400, "VALIDATION_ERROR", "Route parameters are invalid", parsed.error.flatten()));
  req.params = parsed.data as typeof req.params;
  next();
};
