import { db } from "~/db";
import { xpEvents, XpSourceType } from "~/db/schema";
import { and, eq, sql } from "drizzle-orm";

export function awardXp(opts: {
  userId: number;
  amount: number;
  sourceType: XpSourceType;
  sourceId: number;
}): boolean {
  const existing = db
    .select({ id: xpEvents.id })
    .from(xpEvents)
    .where(
      and(
        eq(xpEvents.userId, opts.userId),
        eq(xpEvents.sourceType, opts.sourceType),
        eq(xpEvents.sourceId, opts.sourceId)
      )
    )
    .get();

  if (existing) return false;

  db.insert(xpEvents)
    .values({
      userId: opts.userId,
      amount: opts.amount,
      sourceType: opts.sourceType,
      sourceId: opts.sourceId,
    })
    .run();

  return true;
}

export function getTotalXp(userId: number): number {
  const result = db
    .select({ total: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
    .from(xpEvents)
    .where(eq(xpEvents.userId, userId))
    .get();
  return result?.total ?? 0;
}
