import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/http-error";
import { failure } from "../utils/api-response";
import { env } from "../config/env";

export const notFoundHandler: RequestHandler = (req, res) => {
  failure(res, 404, "NOT_FOUND", `Route ${req.method} ${req.path} was not found`);
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof HttpError) {
    return failure(res, error.statusCode, error.code, error.message, error.details);
  }
  if (error instanceof ZodError) {
    return failure(res, 400, "VALIDATION_ERROR", "Request validation failed", error.flatten());
  }
  if (error instanceof SyntaxError && "status" in error && error.status === 400) {
    return failure(res, 400, "INVALID_JSON", "Request body contains malformed JSON");
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
    return failure(res, 409, "CONFLICT", "A record with this value already exists");
  }
  const message = error instanceof Error ? error.message : "Unexpected server error";
  if (env.NODE_ENV !== "test") console.error("Unhandled request error:", error);
  return failure(res, 500, "INTERNAL_SERVER_ERROR", env.NODE_ENV === "production" ? "Internal server error" : message);
};
