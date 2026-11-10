import type Database from "better-sqlite3";
import type { FastifyInstance } from "fastify";
import type { JobWorkerHandle } from "../jobs/worker.js";

export async function registerHealthRoutes(
  app: FastifyInstance,
  sqlite: Database.Database,
  worker: JobWorkerHandle | null,
): Promise<void> {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ready", async (_req, reply) => {
    try {
      sqlite.prepare("SELECT 1").get();
    } catch {
      return reply.status(503).send({ status: "not_ready", reason: "database" });
    }
    if (!worker?.running) {
      return reply.status(503).send({ status: "not_ready", reason: "worker" });
    }
    return { status: "ready" };
  });
}
