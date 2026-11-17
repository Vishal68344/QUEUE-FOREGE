import type { Response } from "express";

export function success<T>(res: Response, data: T, statusCode = 200, meta?: unknown): Response {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(meta === undefined ? {} : { meta })
  });
}

export function failure(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): Response {
  return res.status(statusCode).json({
    success: false,
    error: { code, message, ...(details === undefined ? {} : { details }) }
  });
}
