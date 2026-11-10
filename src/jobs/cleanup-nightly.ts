import { inArray, lt, lte, isNotNull, eq } from "drizzle-orm";
import type { AppDatabase } from "../db/client.js";
import {
  idempotencyKeys,
  orders,
  pushRegistrations,
} from "../db/schema.js";

export async function runOrderCleanup(db: AppDatabase): Promise<void> {
  const now = Date.now();
  await db
    .update(orders)
    .set({ status: "cancelled", updatedAt: now })
    .where(lt(orders.expiresAt, now));

  const terminal = await db.query.orders.findMany({
    where: inArray(orders.status, ["picked_up", "cancelled"]),
    columns: { id: true },
  });
  const terminalIds = terminal.map((o) => o.id);
  if (terminalIds.length > 0) {
    for (const orderId of terminalIds) {
      await db
        .update(pushRegistrations)
        .set({ invalidatedAt: now })
        .where(eq(pushRegistrations.orderId, orderId));
    }
  }

  await db
    .delete(idempotencyKeys)
    .where(lte(idempotencyKeys.expiresAt, now));
}
