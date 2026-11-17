import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { User, type UserDocument } from "../models/User";
import { HttpError } from "../utils/http-error";

export interface AuthUser {
  id: string;
  email: string;
  createdAt: Date;
}

function serializeUser(user: UserDocument): AuthUser {
  return { id: user.id, email: user.email, createdAt: user.createdAt ?? new Date() };
}

function createToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] });
}

export async function register(email: string, password: string): Promise<{ user: AuthUser; accessToken: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw new HttpError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const user = await User.create({ email: normalizedEmail, passwordHash });
  return { user: serializeUser(user), accessToken: createToken(user.id) };
}

export async function login(email: string, password: string): Promise<{ user: AuthUser; accessToken: string }> {
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  return { user: serializeUser(user), accessToken: createToken(user.id) };
}
