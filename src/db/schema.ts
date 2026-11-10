import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { OrderItem } from "../types/order.js";

export const shops = sqliteTable(
  "shops",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    apnsTopicBundleId: text("apns_topic_bundle_id").notNull(),
    timezone: text("timezone").notNull().default("America/New_York"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("shops_slug_uq").on(t.slug)],
);

export const shopDailyCounters = sqliteTable(
  "shop_daily_counters",
  {
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id),
    businessDate: text("business_date").notNull(),
    counter: integer("counter", { mode: "number" }).notNull().default(0),
  },
  (t) => [
    uniqueIndex("shop_daily_counters_uq").on(t.shopId, t.businessDate),
  ],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id),
    orderNumber: text("order_number").notNull(),
    businessDate: text("business_date").notNull(),
    items: text("items", { mode: "json" }).$type<OrderItem[]>().notNull(),
    status: text("status").notNull().default("received"),
    etaMinutes: integer("eta_minutes", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
    readyAt: integer("ready_at", { mode: "number" }),
    expiresAt: integer("expires_at", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("orders_shop_date_number_uq").on(
      t.shopId,
      t.businessDate,
      t.orderNumber,
    ),
    index("orders_shop_status_idx").on(t.shopId, t.status),
  ],
);

export const pushRegistrations = sqliteTable(
  "push_registrations",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    platform: text("platform").notNull(),
    token: text("token").notNull(),
    environment: text("environment").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    lastSuccessAt: integer("last_success_at", { mode: "number" }),
    invalidatedAt: integer("invalidated_at", { mode: "number" }),
  },
  (t) => [
    uniqueIndex("push_registrations_order_platform_uq").on(
      t.orderId,
      t.platform,
    ),
    index("push_registrations_order_idx").on(t.orderId),
  ],
);

export const orderEvents = sqliteTable(
  "order_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actor: text("actor").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const staffUsers = sqliteTable(
  "staff_users",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("staff_users_shop_email_uq").on(t.shopId, t.email)],
);

export const staffRefreshTokens = sqliteTable(
  "staff_refresh_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => staffUsers.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "number" }).notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "number" }),
  },
  (t) => [index("staff_refresh_tokens_user_idx").on(t.userId)],
);

export const idempotencyKeys = sqliteTable(
  "idempotency_keys",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    responseBody: text("response_body", { mode: "json" }).$type<unknown>(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    expiresAt: integer("expires_at", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("idempotency_keys_key_uq").on(t.key)],
);

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text("idempotency_key"),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts", { mode: "number" }).notNull().default(0),
    runAfter: integer("run_after", { mode: "number" }).notNull(),
    lockedAt: integer("locked_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    lastError: text("last_error"),
  },
  (t) => [
    index("jobs_poll_idx").on(t.status, t.runAfter),
    uniqueIndex("jobs_idempotency_uq").on(t.idempotencyKey),
  ],
);

export const notificationDeadLetters = sqliteTable(
  "notification_dead_letters",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").references(() => orders.id),
    jobId: text("job_id").references(() => jobs.id),
    channel: text("channel").notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    payloadSnippet: text("payload_snippet"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
);

