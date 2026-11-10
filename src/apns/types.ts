import type { ApnsEnvironment, OrderStatus } from "../types/order.js";

export interface ApnsSendResult {
  statusCode: number;
  apnsId?: string;
  reason?: string;
}

export interface LiveActivityPushInput {
  token: string;
  environment: ApnsEnvironment;
  topicBundleId: string;
  orderNumber: string;
  status: OrderStatus;
  etaMinutes: number | null;
  updatedAtSec: number;
  expiresAtSec: number;
  priority: 5 | 10;
}
