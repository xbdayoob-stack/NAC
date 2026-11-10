import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import type { Env } from "../config/env.js";
import type { AppDatabase } from "../db/client.js";
import { orderEvents, orders } from "../db/schema.js";
import { createStaffAuthHook } from "../plugins/staff-auth.js";
import { canTransition } from "../domain/order-status.js";
import { newId, nextOrderNumber } from "../domain/order-number.js";
import { buildOrderQr } from "../qr/generate.js";
import { enqueueJob } from "../jobs/queue.js";
import type { OrderItem, OrderStatus } from "../types/order.js";
import { ORDER_STATUSES } from "../types/order.js";

const createSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().int().positive(),
      modifiers: z.array(z.string()).optional(),
    }),
  ),
  etaMinutes: z.number().int().nonnegative().optional(),
});

const patchSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  etaMinutes: z.number().int().nonnegative().optional(),
});

const ACTIVE_STATUSES: OrderStatus[] = [
  "received",
  "preparing",
  "ready",
];

export async function registerStaffOrderRoutes(
  app: FastifyInstance,
  db: AppDatabase,
  env: Env,
): Promise<void> {
  const staffAuth = createStaffAuthHook(env);

  app.get(
    "/v1/staff/orders",
    { preHandler: staffAuth },
    async (request, reply) => {
      const staff = request.staff;
      if (!staff) return reply.status(401).send({ error: "Unauthorized" });

      const statusParam = (request.query as { status?: string }).status;
      const statuses = statusParam
        ? statusParam.split(",").map((s) => s.trim())
        : ACTIVE_STATUSES;

      const rows = await db.query.orders.findMany({
        where: and(
          eq(orders.shopId, staff.shopId),
          inArray(orders.status, statuses),
        ),
        orderBy: (o, { asc }) => [asc(o.createdAt)],
      });

      return rows.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        etaMinutes: o.etaMinutes,
        items: o.items,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      }));
    },
  );

  app.post(
    "/v1/staff/orders",
    { preHandler: staffAuth },
    async (request, reply) => {
      const staff = request.staff;
      if (!staff) return reply.status(401).send({ error: "Unauthorized" });

      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const orderId = newId();
      const { orderNumber, businessDate } = await nextOrderNumber(
        db,
        staff.shopId,
      );
      const now = Date.now();
      const expiresAt = now + env.ORDER_EXPIRY_HOURS * 3600 * 1000;

      await db.insert(orders).values({
        id: orderId,
        shopId: staff.shopId,
        orderNumber,
        businessDate,
        items: parsed.data.items as OrderItem[],
        status: "received",
        etaMinutes: parsed.data.etaMinutes ?? null,
        createdAt: now,
        updatedAt: now,
        expiresAt,
      });

      await db.insert(orderEvents).values({
        id: nanoid(),
        orderId,
        fromStatus: null,
        toStatus: "received",
        actor: staff.sub,
        createdAt: now,
      });

      const qr = await buildOrderQr(orderId, env);

      await enqueueJob(db, {
        name: "notify.order_status",
        payload: {
          orderId,
          fromStatus: null,
          toStatus: "received",
          actor: staff.sub,
        },
        idempotencyKey: `notify:${orderId}:received:${now}`,
      });

      return {
        orderId,
        orderNumber,
        qrUrl: qr.qrUrl,
        qrPngBase64: qr.qrPngBase64,
      };
    },
  );

  app.patch(
    "/v1/staff/orders/:id/status",
    { preHandler: staffAuth },
    async (request, reply) => {
      const staff = request.staff;
      if (!staff) return reply.status(401).send({ error: "Unauthorized" });

      const { id } = request.params as { id: string };
      const parsed = patchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, id), eq(orders.shopId, staff.shopId)),
      });
      if (!order) {
        return reply.status(404).send({ error: "Not found" });
      }

      const fromStatus = order.status as OrderStatus;
      const toStatus = parsed.data.status;

      const etaOnly =
        fromStatus === toStatus && parsed.data.etaMinutes !== undefined;

      if (!etaOnly) {
        const check = canTransition(fromStatus, toStatus);
        if (!check.ok) {
          return reply.status(409).send({ error: check.reason });
        }
      }

      const now = Date.now();
      const updates: Partial<typeof orders.$inferInsert> = {
        updatedAt: now,
      };
      if (!etaOnly) {
        updates.status = toStatus;
      }
      if (parsed.data.etaMinutes !== undefined) {
        updates.etaMinutes = parsed.data.etaMinutes;
      }
      if (toStatus === "ready" && !etaOnly) {
        updates.readyAt = now;
      }

      await db.update(orders).set(updates).where(eq(orders.id, id));

      if (!etaOnly) {
        await db.insert(orderEvents).values({
          id: nanoid(),
          orderId: id,
          fromStatus,
          toStatus,
          actor: staff.sub,
          createdAt: now,
        });
      }

      await enqueueJob(db, {
        name: "notify.order_status",
        payload: {
          orderId: id,
          fromStatus: etaOnly ? fromStatus : fromStatus,
          toStatus: etaOnly ? fromStatus : toStatus,
          actor: staff.sub,
          etaOnly,
        },
        idempotencyKey: etaOnly
          ? `notify:${id}:eta:${parsed.data.etaMinutes}:${now}`
          : `notify:${id}:${toStatus}:${now}`,
      });

      const updated = await db.query.orders.findFirst({
        where: eq(orders.id, id),
      });
      return {
        id,
        status: updated?.status,
        etaMinutes: updated?.etaMinutes,
        updatedAt: updated?.updatedAt,
      };
    },
  );
}
