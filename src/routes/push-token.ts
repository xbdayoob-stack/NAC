import { eq } from "drizzle-orm";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import type { AppDatabase } from "../db/client.js";
import { orders, pushRegistrations } from "../db/schema.js";
import { rateLimitByIp, rateLimitByOrderId } from "../middleware/rate-limit.js";

const bodySchema = z.object({
  token: z.string().min(10),
  environment: z.enum(["sandbox", "production"]),
  platform: z.enum(["live_activity"]),
});

export async function registerPushTokenRoutes(
  app: FastifyInstance,
  db: AppDatabase,
): Promise<void> {
  app.post(
    "/v1/orders/:orderId/push-token",
    {
      preHandler: [rateLimitByIp(), rateLimitByOrderId()],
    },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
      });
      if (!order || order.expiresAt < Date.now()) {
        return reply.status(404).send({ error: "Not found" });
      }

      const now = Date.now();
      const existing = await db.query.pushRegistrations.findFirst({
        where: (t, { and, eq: e }) =>
          and(e(t.orderId, orderId), e(t.platform, parsed.data.platform)),
      });

      if (existing) {
        await db
          .update(pushRegistrations)
          .set({
            token: parsed.data.token,
            environment: parsed.data.environment,
            invalidatedAt: null,
            createdAt: now,
          })
          .where(eq(pushRegistrations.id, existing.id));
      } else {
        await db.insert(pushRegistrations).values({
          id: nanoid(),
          orderId,
          platform: parsed.data.platform,
          token: parsed.data.token,
          environment: parsed.data.environment,
          createdAt: now,
        });
      }

      return { ok: true };
    },
  );
}
