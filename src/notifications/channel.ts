import type { orders, orderEvents } from "../db/schema.js";

export type OrderRow = typeof orders.$inferSelect;
export type OrderEventRow = typeof orderEvents.$inferSelect;

export interface NotificationContext {
  order: OrderRow;
  event: {
    fromStatus: string | null;
    toStatus: string;
    actor: string;
  };
  etaOnly?: boolean;
}

export interface ChannelResult {
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
}

export interface NotificationChannel {
  readonly name: string;
  send(ctx: NotificationContext): Promise<ChannelResult>;
}
