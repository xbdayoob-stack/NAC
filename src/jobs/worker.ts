import type Database from "better-sqlite3";
import type { FastifyBaseLogger } from "fastify";
import cron from "node-cron";
import type { AppDatabase } from "../db/client.js";
import {
  claimNextJob,
  completeJob,
  retryJob,
  requeueStuckJobs,
} from "./queue.js";
import {
  handleNotifyOrderJob,
  recordDeadLetter,
  type NotifyJobPayload,
} from "./notify-order.js";
import { runOrderCleanup } from "./cleanup-nightly.js";
import type { NotificationDispatcher } from "../notifications/dispatcher.js";
import type { SseHub } from "../sse/hub.js";

export interface JobWorkerHandle {
  stop: () => void;
  drainOnce: () => Promise<void>;
  running: boolean;
}

export function startJobWorker(opts: {
  sqlite: Database.Database;
  db: AppDatabase;
  log: FastifyBaseLogger;
  dispatcher: NotificationDispatcher;
  sse: SseHub;
  pollMs?: number;
}): JobWorkerHandle {
  let running = true;
  let stopped = false;
  const pollMs = opts.pollMs ?? 400;

  const interval = setInterval(() => {
    void drain();
  }, pollMs);

  const cronTask = cron.schedule("0 3 * * *", () => {
    void runOrderCleanup(opts.db).catch((e) =>
      opts.log.error(e, "cleanup job failed"),
    );
  });

  async function processJob(
    job: NonNullable<ReturnType<typeof claimNextJob>>,
  ): Promise<void> {
    try {
      if (job.name === "notify.order_status") {
        await handleNotifyOrderJob(
          opts.db,
          opts.dispatcher,
          opts.sse,
          job.payload as unknown as NotifyJobPayload,
        );
      } else if (job.name === "cleanup.orders") {
        await runOrderCleanup(opts.db);
      }
      await completeJob(opts.db, job.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await retryJob(opts.db, job.id, message);
      const row = await opts.db.query.jobs.findFirst({
        where: (j, { eq }) => eq(j.id, job.id),
      });
      if (row?.status === "dead") {
        await recordDeadLetter(opts.db, {
          jobId: job.id,
          channel: "dispatcher",
          errorMessage: message,
          payloadSnippet: JSON.stringify(job.payload).slice(0, 500),
          orderId:
            typeof job.payload.orderId === "string"
              ? job.payload.orderId
              : undefined,
        });
      }
    }
  }

  async function drain(): Promise<void> {
    if (!running) return;
    await requeueStuckJobs(opts.db).catch(() => undefined);
    for (let i = 0; i < 10; i++) {
      const job = claimNextJob(opts.sqlite);
      if (!job) break;
      try {
        await processJob(job);
      } catch {
        /* logged via retry/dead letter */
      }
    }
  }

  return {
    running: true,
    stop() {
      if (stopped) return;
      stopped = true;
      running = false;
      clearInterval(interval);
      cronTask.stop();
    },
    drainOnce: drain,
  };
}
