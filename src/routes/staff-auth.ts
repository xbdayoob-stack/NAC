import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import type { Env } from "../config/env.js";
import type { AppDatabase } from "../db/client.js";
import { staffRefreshTokens, staffUsers } from "../db/schema.js";
import { verifyPassword } from "../auth/password.js";
import {
  hashRefreshToken,
  newRefreshJti,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_TTL_SEC,
} from "../auth/jwt.js";
import type { StaffRole } from "../types/order.js";
import { rateLimitLogin } from "../middleware/rate-limit.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  shopId: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export async function registerStaffAuthRoutes(
  app: FastifyInstance,
  db: AppDatabase,
  env: Env,
): Promise<void> {
  app.post(
    "/v1/auth/login",
    { preHandler: [rateLimitLogin()] },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const users = await db.query.staffUsers.findMany({
        where: eq(staffUsers.email, parsed.data.email.toLowerCase()),
      });
      const user =
        users.find((u) =>
          parsed.data.shopId ? u.shopId === parsed.data.shopId : true,
        ) ?? users[0];

      if (!user) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }
      const ok = await verifyPassword(user.passwordHash, parsed.data.password);
      if (!ok) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      const accessToken = await signAccessToken(env.JWT_SECRET, {
        sub: user.id,
        shopId: user.shopId,
        role: user.role as StaffRole,
      });

      const jti = newRefreshJti();
      const refreshToken = await signRefreshToken(
        env.JWT_REFRESH_SECRET,
        user.id,
        jti,
      );
      const tokenHash = hashRefreshToken(refreshToken);
      const now = Date.now();

      await db.insert(staffRefreshTokens).values({
        id: nanoid(),
        userId: user.id,
        tokenHash,
        expiresAt: now + REFRESH_TTL_SEC * 1000,
        createdAt: now,
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: 900,
      };
    },
  );

  app.post("/v1/auth/refresh", async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    let claims;
    try {
      claims = await verifyRefreshToken(
        env.JWT_REFRESH_SECRET,
        parsed.data.refreshToken,
      );
    } catch {
      return reply.status(401).send({ error: "Invalid refresh token" });
    }

    const tokenHash = hashRefreshToken(parsed.data.refreshToken);
    const stored = await db.query.staffRefreshTokens.findFirst({
      where: and(
        eq(staffRefreshTokens.userId, claims.sub),
        eq(staffRefreshTokens.tokenHash, tokenHash),
        isNull(staffRefreshTokens.revokedAt),
      ),
    });
    if (!stored || stored.expiresAt < Date.now()) {
      return reply.status(401).send({ error: "Invalid refresh token" });
    }

    await db
      .update(staffRefreshTokens)
      .set({ revokedAt: Date.now() })
      .where(eq(staffRefreshTokens.id, stored.id));

    const user = await db.query.staffUsers.findFirst({
      where: eq(staffUsers.id, claims.sub),
    });
    if (!user) {
      return reply.status(401).send({ error: "Invalid refresh token" });
    }

    const accessToken = await signAccessToken(env.JWT_SECRET, {
      sub: user.id,
      shopId: user.shopId,
      role: user.role as StaffRole,
    });
    const jti = newRefreshJti();
    const refreshToken = await signRefreshToken(
      env.JWT_REFRESH_SECRET,
      user.id,
      jti,
    );
    const now = Date.now();
    await db.insert(staffRefreshTokens).values({
      id: nanoid(),
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: now + REFRESH_TTL_SEC * 1000,
      createdAt: now,
    });

    return { accessToken, refreshToken, expiresIn: 900 };
  });
}
