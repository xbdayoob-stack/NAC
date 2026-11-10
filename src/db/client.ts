import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database as SqliteDatabase } from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export interface DatabaseHandle {
  sqlite: SqliteDatabase;
  db: AppDatabase;
}

export function createDatabase(sqlitePath: string): DatabaseHandle {
  if (sqlitePath !== ":memory:") {
    const dir = path.dirname(sqlitePath);
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(sqlitePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  return { sqlite, db };
}

export function runMigrations(sqlite: Database.Database): void {
  const migrationsDir = path.join(process.cwd(), "drizzle");
  if (!fs.existsSync(migrationsDir)) {
    applyBootstrapSchema(sqlite);
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(
    sqlite
      .prepare("SELECT hash FROM __drizzle_migrations")
      .all()
      .map((r) => (r as { hash: string }).hash),
  );

  for (const file of files) {
    const hash = file;
    if (applied.has(hash)) continue;
    const sqlContent = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const statements = sqlContent
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    const migrate = sqlite.transaction(() => {
      for (const stmt of statements) {
        sqlite.exec(stmt);
      }
      sqlite
        .prepare(
          "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
        )
        .run(hash, Date.now());
    });
    migrate();
  }
}

/** Used when drizzle SQL folder is not generated yet (tests / first boot). */
function applyBootstrapSchema(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      apns_topic_bundle_id TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/New_York',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shop_daily_counters (
      shop_id TEXT NOT NULL REFERENCES shops(id),
      business_date TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      UNIQUE(shop_id, business_date)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id),
      order_number TEXT NOT NULL,
      business_date TEXT NOT NULL,
      items TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'received',
      eta_minutes INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      ready_at INTEGER,
      expires_at INTEGER NOT NULL,
      UNIQUE(shop_id, business_date, order_number)
    );
    CREATE INDEX IF NOT EXISTS orders_shop_status_idx ON orders(shop_id, status);
    CREATE TABLE IF NOT EXISTS push_registrations (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      platform TEXT NOT NULL,
      token TEXT NOT NULL,
      environment TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_success_at INTEGER,
      invalidated_at INTEGER,
      UNIQUE(order_id, platform)
    );
    CREATE INDEX IF NOT EXISTS push_registrations_order_idx ON push_registrations(order_id);
    CREATE TABLE IF NOT EXISTS order_events (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      from_status TEXT,
      to_status TEXT NOT NULL,
      actor TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events(order_id);
    CREATE TABLE IF NOT EXISTS staff_users (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id),
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(shop_id, email)
    );
    CREATE TABLE IF NOT EXISTS staff_refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES staff_users(id),
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      revoked_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      response_body TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      payload TEXT NOT NULL,
      idempotency_key TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      run_after INTEGER NOT NULL,
      locked_at INTEGER,
      created_at INTEGER NOT NULL,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS jobs_poll_idx ON jobs(status, run_after);
    CREATE TABLE IF NOT EXISTS notification_dead_letters (
      id TEXT PRIMARY KEY,
      order_id TEXT REFERENCES orders(id),
      job_id TEXT REFERENCES jobs(id),
      channel TEXT NOT NULL,
      error_code TEXT,
      error_message TEXT,
      payload_snippet TEXT,
      created_at INTEGER NOT NULL
    );
  `);
}
