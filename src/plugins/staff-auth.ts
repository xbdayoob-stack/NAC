import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken, type StaffAccessClaims } from "../auth/jwt.js";
import type { Env } from "../config/env.js";

declare module "fastify" {
  interface FastifyRequest {
    staff?: StaffAccessClaims;
  }
}

export function createStaffAuthHook(env: Env) {
  return async function staffAuth(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const token = header.slice(7);
    try {
      request.staff = await verifyAccessToken(env.JWT_SECRET, token);
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  };
}
