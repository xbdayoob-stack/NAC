import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Env } from "../config/env.js";
import type { AppDatabase } from "../db/client.js";
import { orders, shops } from "../db/schema.js";
import { renderStatusPage } from "../views/status-page.js";
import { rateLimitByIp } from "../middleware/rate-limit.js";

export async function registerHtmlStatusRoutes(
  app: FastifyInstance,
  db: AppDatabase,
  env: Env,
): Promise<void> {
  app.get(
    "/o/:orderId",
    { preHandler: [rateLimitByIp()] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const row = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
      });
      if (!row || row.expiresAt < Date.now()) {
        return reply.status(404).type("text/html").send("<p>Order not found</p>");
      }
      const shop = await db.query.shops.findFirst({
        where: eq(shops.id, row.shopId),
      });
      const html = renderStatusPage({
        env,
        orderId,
        orderNumber: row.orderNumber,
        shopName: shop?.name ?? "Coffee Shop",
        status: row.status,
        etaMinutes: row.etaMinutes,
      });
      return reply.type("text/html").send(html);
    },
  );
}
