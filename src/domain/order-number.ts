import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { AppDatabase } from "../db/client.js";
import { shopDailyCounters, shops } from "../db/schema.js";

function businessDateInTimezone(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const PREFIXES = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function formatOrderNumber(counter: number): string {
  const prefix = PREFIXES[Math.floor((counter - 1) / 100) % PREFIXES.length]!;
  const num = ((counter - 1) % 100) + 1;
  return `${prefix}-${num}`;
}

export async function nextOrderNumber(
  db: AppDatabase,
  shopId: string,
): Promise<{ orderNumber: string; businessDate: string }> {
  const shop = await db.query.shops.findFirst({
    where: eq(shops.id, shopId),
  });
  if (!shop) throw new Error("Shop not found");

  const businessDate = businessDateInTimezone(shop.timezone);

  await db
    .insert(shopDailyCounters)
    .values({ shopId, businessDate, counter: 1 })
    .onConflictDoUpdate({
      target: [shopDailyCounters.shopId, shopDailyCounters.businessDate],
      set: { counter: sql`${shopDailyCounters.counter} + 1` },
    });

  const row = await db.query.shopDailyCounters.findFirst({
    where: (t, { and, eq: e }) =>
      and(e(t.shopId, shopId), e(t.businessDate, businessDate)),
  });
  if (!row) throw new Error("Failed to allocate order number");

  return {
    orderNumber: formatOrderNumber(row.counter),
    businessDate,
  };
}

export function newId(): string {
  return nanoid(21);
}
