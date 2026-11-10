import type { OrderStatus } from "../types/order.js";

const FINAL: OrderStatus[] = ["picked_up", "cancelled"];

export function isFinalStatus(status: OrderStatus): boolean {
  return FINAL.includes(status);
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
): { ok: true } | { ok: false; reason: string } {
  if (from === to) {
    return { ok: true };
  }
  if (isFinalStatus(from)) {
    return { ok: false, reason: `Order is already ${from}` };
  }
  if (to === "cancelled") {
    return { ok: true };
  }
  const happy: Record<OrderStatus, OrderStatus | null> = {
    received: "preparing",
    preparing: "ready",
    ready: "picked_up",
    picked_up: null,
    cancelled: null,
  };
  if (happy[from] === to) {
    return { ok: true };
  }
  return { ok: false, reason: `Invalid transition ${from} -> ${to}` };
}
