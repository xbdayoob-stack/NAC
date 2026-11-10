import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { AppDatabase } from "../db/client.js";
import { notificationDeadLetters, orders } from "../db/schema.js";
import type { NotificationDispatcher } from "../notifications/dispatcher.js";
import { debounceOrderNotify } from "../notifications/coalesce.js";
import type { SseHub } from "../sse/hub.js";
import type { OrderStatus } from "../types/order.js";

export interface NotifyJobPayload {
  orderId: string;
  toStatus: OrderStatus;
  fromStatus: OrderStatus | null;
  actor: string;
  etaOnly?: boolean;
}

export async function handleNotifyOrderJob(
  db: AppDatabase,
  dispatcher: NotificationDispatcher,
  sse: SseHub,
  payload: NotifyJobPayload,
): Promise<void> {
  await debounceOrderNotify(payload.orderId);

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, payload.orderId),
  });
  if (!order) return;

  sse.broadcast(order.id, {
    status: order.status,
    etaMinutes: order.etaMinutes,
    updatedAt: order.updatedAt,
    orderNumber: order.orderNumber,
  });

  await dispatcher.fanOut({
    order,
    event: {
      fromStatus: payload.fromStatus,
      toStatus: payload.toStatus,
      actor: payload.actor,
    },
    etaOnly: payload.etaOnly,
  });
}

export async function recordDeadLetter(
  db: AppDatabase,
  input: {
    orderId?: string;
    jobId?: string;
    channel: string;
    errorCode?: string;
    errorMessage?: string;
    payloadSnippet?: string;
  },
): Promise<void> {
  await db.insert(notificationDeadLetters).values({
    id: nanoid(),
    orderId: input.orderId ?? null,
    jobId: input.jobId ?? null,
    channel: input.channel,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
    payloadSnippet: input.payloadSnippet ?? null,
    createdAt: Date.now(),
  });
}
