import { describe, expect, it, vi, beforeEach } from "vitest";
import { clearApnsJwtCache, getApnsJwt } from "../../src/apns/jwt.js";
import type { Env } from "../../src/config/env.js";

vi.mock("jose", () => {
  return {
    importPKCS8: vi.fn().mockResolvedValue({}),
    SignJWT: class {
      setProtectedHeader() {
        return this;
      }
      setIssuer() {
        return this;
      }
      setIssuedAt() {
        return this;
      }
      async sign() {
        return "mock.jwt.token";
      }
    },
  };
});

describe("APNs JWT", () => {
  beforeEach(() => {
    clearApnsJwtCache();
  });

  it("caches JWT until forced refresh", async () => {
    const env = {
      APNS_KEY_P8: "-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----",
      APNS_KEY_ID: "KEYID123",
      APNS_TEAM_ID: "TEAM123",
    } as Env;

    const a = await getApnsJwt(env);
    const b = await getApnsJwt(env);
    expect(a).toBe(b);

    clearApnsJwtCache();
    const c = await getApnsJwt(env);
    expect(c).toBe("mock.jwt.token");
  });
});
