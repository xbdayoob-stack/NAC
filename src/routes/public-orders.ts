import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../db/client.js";
import { orders, shops } from "../db/schema.js";
import type { SseHub } from "../sse/hub.js";
import { rateLimitByIp, rateLimitByOrderId } from "../middleware/rate-limit.js";

export async function registerPublicOrderRoutes(
  app: FastifyInstance,
  db: AppDatabase,
  sse: SseHub,
): Promise<void> {
  app.get(
    "/v1/orders/:orderId",
    {
      preHandler: [rateLimitByIp(), rateLimitByOrderId()],
    },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const row = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
      });
      if (!row || row.expiresAt < Date.now()) {
        return reply.status(404).send({ error: "Not found" });
      }
      const shop = await db.query.shops.findFirst({
        where: eq(shops.id, row.shopId),
      });
      return {
        orderNumber: row.orderNumber,
        shopName: shop?.name ?? "Coffee Shop",
        status: row.status,
        etaMinutes: row.etaMinutes,
        updatedAt: row.updatedAt,
      };
    },
  );

  app.get(
    "/v1/orders/:orderId/stream",
    {
      preHandler: [rateLimitByIp(), rateLimitByOrderId()],
    },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const row = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
      });
      if (!row || row.expiresAt < Date.now()) {
        return reply.status(404).send({ error: "Not found" });
      }

      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      reply.raw.write(
        `event: status\ndata: ${JSON.stringify({
          status: row.status,
          etaMinutes: row.etaMinutes,
          updatedAt: row.updatedAt,
          orderNumber: row.orderNumber,
        })}\n\n`,
      );
      sse.subscribe(orderId, reply.raw);
    },
  );
}
