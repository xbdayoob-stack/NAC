import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { buildApp, type AppContext } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import { seedDemoShop } from "../../src/db/seed.js";
import { clearCoalesceState } from "../../src/notifications/coalesce.js";
import { clearRateLimitState } from "../../src/middleware/rate-limit.js";

describe("order flow API", () => {
  let ctx: AppContext;
  let accessToken: string;

  beforeAll(async () => {
    process.env.COALESCE_MS = "0";
    clearCoalesceState();
    clearRateLimitState();
    const env = loadEnv({
      NODE_ENV: "test",
      SQLITE_PATH: ":memory:",
      JWT_SECRET: "test-jwt-secret-123456",
      JWT_REFRESH_SECRET: "test-refresh-secret-123",
      PUBLIC_BASE_URL: "http://localhost:3000",
    });
    ctx = await buildApp({ env, migrate: true });
    await seedDemoShop(ctx.db);
    const login = await ctx.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "barista@demo.local",
        password: "password123",
      },
    });
    accessToken = login.json().accessToken;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("creates order, registers token, marks ready, drains notify job", async () => {
    const create = await ctx.app.inject({
      method: "POST",
      url: "/v1/staff/orders",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { items: [{ name: "Latte", quantity: 1 }] },
    });
    expect(create.statusCode).toBe(200);
    const { orderId, orderNumber } = create.json();

    const pub = await ctx.app.inject({
      method: "GET",
      url: `/v1/orders/${orderId}`,
    });
    expect(pub.json().orderNumber).toBe(orderNumber);

    await ctx.app.inject({
      method: "POST",
      url: `/v1/orders/${orderId}/push-token`,
      payload: {
        token: "fake-live-activity-token",
        environment: "sandbox",
        platform: "live_activity",
      },
    });

    const patch = await ctx.app.inject({
      method: "PATCH",
      url: `/v1/staff/orders/${orderId}/status`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: "preparing" },
    });
    expect(patch.statusCode).toBe(200);

    await ctx.app.inject({
      method: "PATCH",
      url: `/v1/staff/orders/${orderId}/status`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { status: "ready" },
    });

    await ctx.worker?.drainOnce();

    const after = await ctx.app.inject({
      method: "GET",
      url: `/v1/orders/${orderId}`,
    });
    expect(after.json().status).toBe("ready");
  });
});
