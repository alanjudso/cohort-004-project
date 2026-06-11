import { db } from "~/db";
import {
  xpEvents,
  lessons,
  lessonProgress,
  LessonProgressStatus,
  XpSourceType,
} from "~/db/schema";
import { and, eq, sql, or } from "drizzle-orm";

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

export function checkModuleCompleted(
  userId: number,
  moduleId: number
): { completed: boolean; lessonCount: number; totalXp: number } {
  const moduleLessons = db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
    .all();

  if (moduleLessons.length === 0) {
    return { completed: false, lessonCount: 0, totalXp: 0 };
  }

  const completedCount = db
    .select({ count: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        or(...moduleLessons.map((l) => eq(lessonProgress.lessonId, l.id)))!
      )
    )
    .get();

  return {
    completed: (completedCount?.count ?? 0) === moduleLessons.length,
    lessonCount: moduleLessons.length,
    totalXp: moduleLessons.length * 10,
  };
}
