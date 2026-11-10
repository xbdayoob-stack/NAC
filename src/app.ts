import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import type Database from "better-sqlite3";
import type { Env } from "./config/env.js";
import { getCorsOrigins } from "./config/env.js";
import { createDatabase, runMigrations, type AppDatabase } from "./db/client.js";
import { ApnsClient } from "./apns/client.js";
import { LiveActivityChannel } from "./notifications/live-activity.channel.js";
import { NotificationDispatcher } from "./notifications/dispatcher.js";
import { SseHub } from "./sse/hub.js";
import { startJobWorker, type JobWorkerHandle } from "./jobs/worker.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAasaRoutes } from "./routes/aasa.js";
import { registerPublicOrderRoutes } from "./routes/public-orders.js";
import { registerPushTokenRoutes } from "./routes/push-token.js";
import { registerHtmlStatusRoutes } from "./routes/html-status.js";
import { registerStaffAuthRoutes } from "./routes/staff-auth.js";
import { registerStaffOrderRoutes } from "./routes/staff-orders.js";
import { registerPosWebhookRoutes } from "./routes/integrations-pos.js";
import { registerStaffUiRoutes } from "./routes/staff-ui.js";

export interface AppContext {
  app: ReturnType<typeof Fastify>;
  db: AppDatabase;
  sqlite: Database.Database;
  env: Env;
  worker: JobWorkerHandle | null;
  sse: SseHub;
  apns: ApnsClient;
}

export interface BuildAppOptions {
  env: Env;
  enableWorker?: boolean;
  migrate?: boolean;
}

export async function buildApp(opts: BuildAppOptions): Promise<AppContext> {
  console.log("[nac] opening sqlite", opts.env.SQLITE_PATH);
  const { sqlite, db } = createDatabase(opts.env.SQLITE_PATH);
  console.log("[nac] sqlite open ok");
  if (opts.migrate !== false) {
    console.log("[nac] running migrations…");
    runMigrations(sqlite);
    console.log("[nac] migrations ok");
  }

  console.log("[nac] creating fastify…");
  const app = Fastify({
    logger: {
      level: opts.env.NODE_ENV === "test" ? "silent" : "info",
    },
  });

  await app.register(cors, {
    origin: getCorsOrigins(opts.env),
    credentials: true,
  });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);

  app.addHook("preParsing", async (request, _reply, payload) => {
    if (!request.url.startsWith("/v1/integrations/pos/webhook")) {
      return payload;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    (request as { rawBody?: string }).rawBody = raw;
    const { Readable } = await import("node:stream");
    return Readable.from([raw]);
  });

  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      try {
        const parsed = body === "" ? {} : JSON.parse(body as string);
        done(null, parsed);
      } catch (e) {
        done(e as Error, undefined);
      }
    },
  );

  const sse = new SseHub();
  const apns = new ApnsClient(opts.env);
  const channels = [
    new LiveActivityChannel(db, opts.env, apns),
  ];
  const dispatcher = new NotificationDispatcher(channels, app.log);

  let worker: JobWorkerHandle | null = null;
  if (opts.enableWorker !== false) {
    worker = startJobWorker({
      sqlite,
      db,
      log: app.log,
      dispatcher,
      sse,
    });
  }

  await registerHealthRoutes(app, sqlite, worker);
  await registerAasaRoutes(app, opts.env);
  await registerPublicOrderRoutes(app, db, sse);
  await registerPushTokenRoutes(app, db);
  await registerHtmlStatusRoutes(app, db, opts.env);
  await registerStaffAuthRoutes(app, db, opts.env);
  await registerStaffOrderRoutes(app, db, opts.env);
  await registerPosWebhookRoutes(app, db, opts.env);
  await registerStaffUiRoutes(app);
  console.log("[nac] routes registered");

  app.addHook("onClose", async () => {
    worker?.stop();
    sse.closeAll();
    apns.closeAll();
    sqlite.close();
  });

  return { app, db, sqlite, env: opts.env, worker, sse, apns };
}
