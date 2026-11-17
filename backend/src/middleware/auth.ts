import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { User } from "../models/User";
import { failure } from "../utils/api-response";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export const authenticate: RequestHandler = (req, res, next) => {
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    failure(res, 401, "UNAUTHORIZED", "A Bearer token is required");
    return;
  }

  let subject: string;
  try {
    const decoded = jwt.verify(authorization.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof decoded.sub !== "string") {
      failure(res, 401, "UNAUTHORIZED", "The access token is invalid");
      return;
    }
    subject = decoded.sub;
  } catch {
    failure(res, 401, "UNAUTHORIZED", "The access token is invalid or expired");
    return;
  }

  void User.findById(subject).select("email").then((user) => {
    if (!user) {
      failure(res, 401, "UNAUTHORIZED", "The account associated with this token no longer exists");
      return;
    }
    req.authUser = { id: user.id, email: user.email };
    next();
  }).catch(next);
};
