import { and, eq, isNull } from "drizzle-orm";
import type { Env } from "../config/env.js";
import type { AppDatabase } from "../db/client.js";
import { pushRegistrations } from "../db/schema.js";
import {
  buildLiveActivityPayload,
  unixSecondsFromMs,
} from "../apns/payload-builder.js";
import {
  ApnsClient,
  isInvalidDeviceToken,
  isRetryable,
} from "../apns/client.js";
import { apnsConfigured } from "../config/env.js";
import type { ApnsEnvironment } from "../types/order.js";
import type { ChannelResult, NotificationChannel } from "./channel.js";

export class LiveActivityChannel implements NotificationChannel {
  readonly name = "live_activity";

  constructor(
    private readonly db: AppDatabase,
    private readonly env: Env,
    private readonly apns: ApnsClient,
  ) {}

  async send(ctx: Parameters<NotificationChannel["send"]>[0]): Promise<ChannelResult> {
    if (!apnsConfigured(this.env)) {
      return { ok: true };
    }

    const regs = await this.db.query.pushRegistrations.findMany({
      where: and(
        eq(pushRegistrations.orderId, ctx.order.id),
        eq(pushRegistrations.platform, "live_activity"),
        isNull(pushRegistrations.invalidatedAt),
      ),
    });

    if (regs.length === 0) return { ok: true };

    const shop = await this.db.query.shops.findFirst({
      where: (s, { eq: e }) => e(s.id, ctx.order.shopId),
    });
    const bundleId =
      shop?.apnsTopicBundleId ??
      this.env.DEFAULT_APNS_BUNDLE_ID ??
      this.env.APP_CLIP_BUNDLE_ID;
    if (!bundleId) {
      return {
        ok: false,
        errorCode: "no_bundle",
        errorMessage: "APNs topic bundle not configured",
      };
    }

    const updatedAtSec = unixSecondsFromMs(ctx.order.updatedAt);
    const expiresAtSec = unixSecondsFromMs(ctx.order.expiresAt);
    const built = buildLiveActivityPayload({
      status: ctx.order.status as import("../types/order.js").OrderStatus,
      etaMinutes: ctx.order.etaMinutes,
      updatedAtSec,
      expiresAtSec,
      orderNumber: ctx.order.orderNumber,
      etaOnly: ctx.etaOnly,
    });

    const payloadJson = JSON.stringify(built.body);
    let lastResult: ChannelResult = { ok: true };

    for (const reg of regs) {
      const start = Date.now();
      const result = await this.apns.sendLiveActivity(
        reg.environment as ApnsEnvironment,
        {
          token: reg.token,
          topicBundleId: bundleId,
          priority: built.priority,
          expirationSec: expiresAtSec,
          payloadJson,
        },
      );

      if (result.statusCode === 200) {
        await this.db
          .update(pushRegistrations)
          .set({ lastSuccessAt: Date.now() })
          .where(eq(pushRegistrations.id, reg.id));
        lastResult = { ok: true };
        continue;
      }

      if (isInvalidDeviceToken(result)) {
        await this.db
          .update(pushRegistrations)
          .set({ invalidatedAt: Date.now() })
          .where(eq(pushRegistrations.id, reg.id));
        lastResult = {
          ok: false,
          errorCode: result.reason ?? String(result.statusCode),
          retryable: false,
        };
        continue;
      }

      lastResult = {
        ok: false,
        errorCode: result.reason ?? String(result.statusCode),
        errorMessage: `APNs ${result.statusCode}`,
        retryable: isRetryable(result),
      };
    }

    return lastResult;
  }
}
