export const ORDER_STATUSES = [
  "received",
  "preparing",
  "ready",
  "picked_up",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type PushPlatform = "live_activity";

export type ApnsEnvironment = "sandbox" | "production";

export type StaffRole = "barista" | "manager";

export interface OrderItem {
  name: string;
  quantity: number;
  modifiers?: string[];
}
