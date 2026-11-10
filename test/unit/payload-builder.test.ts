import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { buildLiveActivityPayload } from "../../src/apns/payload-builder.js";

const schema = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "schemas/live-activity-content-state.json"),
    "utf8",
  ),
);

describe("buildLiveActivityPayload", () => {
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  it("builds update payload with alert on ready", () => {
    const built = buildLiveActivityPayload({
      status: "ready",
      etaMinutes: 0,
      updatedAtSec: 1_700_000_000,
      expiresAtSec: 1_700_086_400,
      orderNumber: "A-42",
    });
    expect(built.event).toBe("update");
    expect(built.priority).toBe(10);
    const contentState = (built.body.aps as Record<string, unknown>)[
      "content-state"
    ];
    expect(validate(contentState)).toBe(true);
    expect((built.body.aps as { alert?: unknown }).alert).toBeDefined();
  });

  it("builds end payload for picked_up", () => {
    const built = buildLiveActivityPayload({
      status: "picked_up",
      etaMinutes: 0,
      updatedAtSec: 1_700_000_000,
      expiresAtSec: 1_700_086_400,
      orderNumber: "A-42",
    });
    expect(built.event).toBe("end");
    expect((built.body.aps as { "dismissal-date"?: number })["dismissal-date"]).toBeDefined();
  });

  it("uses priority 5 for eta-only", () => {
    const built = buildLiveActivityPayload({
      status: "preparing",
      etaMinutes: 5,
      updatedAtSec: 1_700_000_000,
      expiresAtSec: 1_700_086_400,
      orderNumber: "A-1",
      etaOnly: true,
    });
    expect(built.priority).toBe(5);
  });
});
