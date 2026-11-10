import type { OrderStatus } from "../types/order.js";

export type LiveActivityEvent = "update" | "end";

export interface BuiltLiveActivityPayload {
  event: LiveActivityEvent;
  priority: 5 | 10;
  body: Record<string, unknown>;
}

const TERMINAL: OrderStatus[] = ["picked_up", "cancelled"];

export function buildLiveActivityPayload(input: {
  status: OrderStatus;
  etaMinutes: number | null;
  updatedAtSec: number;
  expiresAtSec: number;
  orderNumber: string;
  etaOnly?: boolean;
}): BuiltLiveActivityPayload {
  const eta = input.etaMinutes ?? 0;
  const isTerminal = TERMINAL.includes(input.status);
  const event: LiveActivityEvent = isTerminal ? "end" : "update";
  const priority: 5 | 10 = input.etaOnly ? 5 : 10;

  const contentState = {
    status: input.status,
    etaMinutes: eta,
    updatedAt: input.updatedAtSec,
  };

  const aps: Record<string, unknown> = {
    timestamp: input.updatedAtSec,
    event,
    "content-state": contentState,
    "stale-date": input.expiresAtSec,
  };

  if (input.status === "ready" && event === "update") {
    aps.alert = {
      title: `Order ${input.orderNumber} is ready`,
      body: "Pick it up at the counter",
      sound: "default",
    };
  }

  if (event === "end") {
    aps["dismissal-date"] = input.updatedAtSec + 15 * 60;
  }

  return {
    event,
    priority,
    body: { aps },
  };
}

export function unixSecondsFromMs(ms: number): number {
  return Math.floor(ms / 1000);
}
