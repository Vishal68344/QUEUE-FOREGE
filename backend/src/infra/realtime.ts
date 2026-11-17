import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";
import { env, allowedOrigins } from "../config/env";
import { REALTIME_CHANNEL } from "../config/constants";
import { getSharedRedis } from "./redis";

export type RealtimeEventName =
  | "job:created"
  | "job:started"
  | "job:completed"
  | "job:failed"
  | "job:retrying"
  | "job:cancelled"
  | "worker:status"
  | "queue:status";

export interface RealtimeEnvelope {
  event: RealtimeEventName;
  payload: Record<string, unknown>;
}

let ioInstance: SocketIOServer | null = null;

export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins.length ? allowedOrigins : false,
      credentials: true
    }
  });

  io.use((socket, next) => {
    const tokenValue = socket.handshake.auth.token;
    if (typeof tokenValue !== "string") return next(new Error("Authentication required"));
    const token = tokenValue.startsWith("Bearer ") ? tokenValue.slice(7) : tokenValue;
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
      if (!decoded.sub) return next(new Error("Invalid authentication token"));
      socket.data.userId = decoded.sub;
      next();
    } catch {
      next(new Error("Invalid authentication token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join("authenticated");
    socket.join(`user:${String(socket.data.userId)}`);
  });

  ioInstance = io;
  return io;
}

export async function startRealtimeBridge(): Promise<() => Promise<void>> {
  const subscriber = getSharedRedis().duplicate({ connectionName: "queueforge-api-realtime-subscriber" });
  await subscriber.subscribe(REALTIME_CHANNEL);
  subscriber.on("message", (_channel, rawMessage) => {
    if (!ioInstance) return;
    try {
      const envelope = JSON.parse(rawMessage) as RealtimeEnvelope;
      const userId = envelope.payload.userId;
      if (typeof userId === "string") {
        ioInstance.to(`user:${userId}`).emit(envelope.event, envelope.payload);
      } else {
        ioInstance.to("authenticated").emit(envelope.event, envelope.payload);
      }
    } catch (error) {
      console.error("Unable to decode realtime event:", error);
    }
  });
  return async () => {
    await subscriber.unsubscribe(REALTIME_CHANNEL);
    await subscriber.quit();
    ioInstance = null;
  };
}

export async function publishRealtime(event: RealtimeEventName, payload: Record<string, unknown>): Promise<void> {
  try {
    await getSharedRedis().publish(REALTIME_CHANNEL, JSON.stringify({ event, payload } satisfies RealtimeEnvelope));
  } catch (error) {
    // Queue persistence/processing must not be rolled back because a live notification failed.
    console.error("Unable to publish realtime event:", error);
  }
}
