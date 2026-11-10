import type { OrderItem } from "../../../types/order.js";

export interface PosWebhookPayload {
  externalId: string;
  shopSlug?: string;
  items: OrderItem[];
  status?: string;
}

export interface PosAdapter {
  readonly name: string;
  parse(body: unknown): PosWebhookPayload;
}
