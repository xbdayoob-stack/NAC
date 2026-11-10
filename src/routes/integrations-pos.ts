import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { FastifyInstance } from "fastify";
import type { Env } from "../config/env.js";
import type { AppDatabase } from "../db/client.js";
import { idempotencyKeys, orders, shops } from "../db/schema.js";
import { verifyPosWebhookHmac } from "../integrations/pos/verify-hmac.js";
import { genericPosAdapter } from "../integrations/pos/adapters/generic.js";
import { newId, nextOrderNumber } from "../domain/order-number.js";
import { enqueueJob } from "../jobs/queue.js";

export async function registerPosWebhookRoutes(
  app: FastifyInstance,
  db: AppDatabase,
  env: Env,
): Promise<void> {
  app.post(
    "/v1/integrations/pos/webhook",
    { config: { rawBody: true } },
    async (request, reply) => {
      if (!env.POS_WEBHOOK_SECRET) {
        return reply.status(503).send({ error: "POS webhook not configured" });
      }

      const raw =
        (request as { rawBody?: string }).rawBody ??
        (typeof request.body === "string"
          ? request.body
          : JSON.stringify(request.body));
      const signature = request.headers["x-signature"] as string | undefined;
      if (!verifyPosWebhookHmac(env.POS_WEBHOOK_SECRET, raw, signature)) {
        return reply.status(401).send({ error: "Invalid signature" });
      }

      const idemKey = request.headers["idempotency-key"] as string | undefined;
      if (idemKey) {
        const cached = await db.query.idempotencyKeys.findFirst({
          where: eq(idempotencyKeys.key, idemKey),
        });
        if (cached?.responseBody) {
          return cached.responseBody;
        }
      }

      let payload;
      try {
        payload = genericPosAdapter.parse(JSON.parse(raw));
      } catch {
        return reply.status(400).send({ error: "Invalid payload" });
      }

      const shop = payload.shopSlug
        ? await db.query.shops.findFirst({
            where: eq(shops.slug, payload.shopSlug),
          })
        : await db.query.shops.findFirst();

      if (!shop) {
        return reply.status(400).send({ error: "Unknown shop" });
      }

      const orderId = newId();
      const { orderNumber, businessDate } = await nextOrderNumber(db, shop.id);
      const now = Date.now();
      const expiresAt = now + env.ORDER_EXPIRY_HOURS * 3600 * 1000;

      await db.insert(orders).values({
        id: orderId,
        shopId: shop.id,
        orderNumber,
        businessDate,
        items: payload.items,
        status: "received",
        etaMinutes: null,
        createdAt: now,
        updatedAt: now,
        expiresAt,
      });

      await enqueueJob(db, {
        name: "notify.order_status",
        payload: {
          orderId,
          fromStatus: null,
          toStatus: "received",
          actor: "pos",
        },
      });

      const response = { orderId, orderNumber, externalId: payload.externalId };

      if (idemKey) {
        await db.insert(idempotencyKeys).values({
          id: nanoid(),
          key: idemKey,
          responseBody: response,
          createdAt: now,
          expiresAt: now + 24 * 3600 * 1000,
        });
      }

      return response;
    },
  );
}
