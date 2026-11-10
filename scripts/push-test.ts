#!/usr/bin/env tsx
import { loadEnv } from "../src/config/env.js";
import { ApnsClient } from "../src/apns/client.js";
import { buildLiveActivityPayload, unixSecondsFromMs } from "../src/apns/payload-builder.js";

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.error("Usage: npm run push:test -- <sandbox_device_token>");
    process.exit(1);
  }

  const env = loadEnv();
  const now = Date.now();
  const built = buildLiveActivityPayload({
    status: "ready",
    etaMinutes: 0,
    updatedAtSec: unixSecondsFromMs(now),
    expiresAtSec: unixSecondsFromMs(now) + 86400,
    orderNumber: "A-42",
  });

  const bundle =
    env.DEFAULT_APNS_BUNDLE_ID ??
    env.APP_CLIP_BUNDLE_ID ??
    "com.example.coffee.clip";

  const client = new ApnsClient(env);
  const result = await client.sendLiveActivity("sandbox", {
    token,
    topicBundleId: bundle,
    priority: built.priority,
    expirationSec: unixSecondsFromMs(now) + 86400,
    payloadJson: JSON.stringify(built.body),
  });

  console.log(JSON.stringify(result, null, 2));
  client.closeAll();
  process.exit(result.statusCode === 200 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
