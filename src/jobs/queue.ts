import { and, eq, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type Database from "better-sqlite3";
import type { AppDatabase } from "../db/client.js";
import { jobs } from "../db/schema.js";

export type JobStatus = "pending" | "processing" | "completed" | "dead";

export interface EnqueueInput {
  name: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  runAfter?: number;
}

export async function enqueueJob(
  db: AppDatabase,
  input: EnqueueInput,
): Promise<string> {
  const id = nanoid();
  const now = Date.now();

  if (input.idempotencyKey) {
    const existing = await db.query.jobs.findFirst({
      where: eq(jobs.idempotencyKey, input.idempotencyKey),
    });
    if (existing) return existing.id;
  }

  await db.insert(jobs).values({
    id,
    name: input.name,
    payload: input.payload,
    idempotencyKey: input.idempotencyKey ?? null,
    status: "pending",
    attempts: 0,
    runAfter: input.runAfter ?? now,
    createdAt: now,
  });
  return id;
}

export function claimNextJob(sqlite: Database.Database): {
  id: string;
  name: string;
  payload: Record<string, unknown>;
  attempts: number;
} | null {
  const claim = sqlite.transaction(() => {
    const row = sqlite
      .prepare(
        `SELECT id, name, payload, attempts FROM jobs
         WHERE status = 'pending' AND run_after <= ?
         ORDER BY id LIMIT 1`,
      )
      .get(Date.now()) as
      | { id: string; name: string; payload: string; attempts: number }
      | undefined;

    if (!row) return null;

    const updated = sqlite
      .prepare(
        `UPDATE jobs SET status = 'processing', locked_at = ? WHERE id = ? AND status = 'pending'`,
      )
      .run(Date.now(), row.id);

    if (updated.changes === 0) return null;

    return {
      id: row.id,
      name: row.name,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      attempts: row.attempts,
    };
  });

  return claim();
}

export async function completeJob(db: AppDatabase, jobId: string): Promise<void> {
  await db.delete(jobs).where(eq(jobs.id, jobId));
}

export async function retryJob(
  db: AppDatabase,
  jobId: string,
  error: string,
  maxAttempts = 5,
): Promise<void> {
  const row = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!row) return;

  const attempts = row.attempts + 1;
  if (attempts >= maxAttempts) {
    await db
      .update(jobs)
      .set({ status: "dead", attempts, lastError: error })
      .where(eq(jobs.id, jobId));
    return;
  }

  const backoffMs = Math.min(60_000, 1000 * 2 ** attempts);
  const jitter = Math.floor(Math.random() * 500);
  await db
    .update(jobs)
    .set({
      status: "pending",
      attempts,
      runAfter: Date.now() + backoffMs + jitter,
      lockedAt: null,
      lastError: error,
    })
    .where(eq(jobs.id, jobId));
}

export async function requeueStuckJobs(
  db: AppDatabase,
  staleMs = 5 * 60 * 1000,
): Promise<void> {
  const cutoff = Date.now() - staleMs;
  await db
    .update(jobs)
    .set({ status: "pending", lockedAt: null })
    .where(
      and(eq(jobs.status, "processing"), lte(jobs.lockedAt, cutoff)),
    );
}
