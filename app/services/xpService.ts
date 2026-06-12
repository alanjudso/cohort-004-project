import { eq, and, sql } from "drizzle-orm";
import { db } from "~/db";
import { xpEvents } from "~/db/schema";

export function awardXp(opts: {
  userId: number;
  amount: number;
  sourceType: string;
  sourceId: number;
}) {
  const existing = db
    .select()
    .from(xpEvents)
    .where(
      and(
        eq(xpEvents.userId, opts.userId),
        eq(xpEvents.sourceType, opts.sourceType),
        eq(xpEvents.sourceId, opts.sourceId)
      )
    )
    .get();

  if (existing) return existing;

  return db
    .insert(xpEvents)
    .values({
      userId: opts.userId,
      amount: opts.amount,
      sourceType: opts.sourceType,
      sourceId: opts.sourceId,
    })
    .returning()
    .get();
}

export function getTotalXp(userId: number) {
  const result = db
    .select({ total: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
    .from(xpEvents)
    .where(eq(xpEvents.userId, userId))
    .get();

  return result?.total ?? 0;
}
