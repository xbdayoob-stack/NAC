import { describe, expect, it } from "vitest";
import { canTransition, isFinalStatus } from "../../src/domain/order-status.js";

describe("order status FSM", () => {
  it("allows happy path transitions", () => {
    expect(canTransition("received", "preparing").ok).toBe(true);
    expect(canTransition("preparing", "ready").ok).toBe(true);
    expect(canTransition("ready", "picked_up").ok).toBe(true);
  });

  it("allows cancel from non-final states", () => {
    expect(canTransition("received", "cancelled").ok).toBe(true);
    expect(canTransition("preparing", "cancelled").ok).toBe(true);
    expect(canTransition("ready", "cancelled").ok).toBe(true);
  });

  it("rejects invalid skips and final transitions", () => {
    expect(canTransition("received", "ready").ok).toBe(false);
    expect(canTransition("picked_up", "preparing").ok).toBe(false);
    expect(canTransition("cancelled", "received").ok).toBe(false);
  });

  it("allows same-status for eta-only updates", () => {
    expect(canTransition("preparing", "preparing").ok).toBe(true);
  });

  it("identifies terminal statuses", () => {
    expect(isFinalStatus("picked_up")).toBe(true);
    expect(isFinalStatus("cancelled")).toBe(true);
    expect(isFinalStatus("ready")).toBe(false);
  });
});
