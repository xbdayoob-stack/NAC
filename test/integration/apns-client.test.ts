import { describe, expect, it, vi, afterEach } from "vitest";
import { isInvalidDeviceToken, isRetryable } from "../../src/apns/client.js";
import * as jwtModule from "../../src/apns/jwt.js";

describe("ApnsClient response handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("classifies 410 and token errors as invalid", () => {
    expect(isInvalidDeviceToken({ statusCode: 410, reason: "Unregistered" })).toBe(true);
    expect(isInvalidDeviceToken({ statusCode: 400, reason: "BadDeviceToken" })).toBe(true);
    expect(isInvalidDeviceToken({ statusCode: 200 })).toBe(false);
  });

  it("classifies retryable responses", () => {
    expect(isRetryable({ statusCode: 429 })).toBe(true);
    expect(isRetryable({ statusCode: 503 })).toBe(true);
    expect(isRetryable({ statusCode: 403, reason: "ExpiredProviderToken" })).toBe(false);
  });

  it("refreshes JWT on ExpiredProviderToken (403 handler path)", async () => {
    const spy = vi.spyOn(jwtModule, "clearApnsJwtCache");
    jwtModule.clearApnsJwtCache();
    expect(spy).toHaveBeenCalled();
  });
});
