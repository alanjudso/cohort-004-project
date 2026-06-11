import { db } from "~/db";
import { streakActivities } from "~/db/schema";
import { and, eq, sql } from "drizzle-orm";

export function getUtcDateString(date?: Date): string {
  const d = date ?? new Date();
  return d.toISOString().slice(0, 10);
}

export function recordStreakActivity(userId: number, date?: Date): void {
  const activityDate = getUtcDateString(date);

  const existing = db
    .select({ id: streakActivities.id })
    .from(streakActivities)
    .where(
      and(
        eq(streakActivities.userId, userId),
        eq(streakActivities.activityDate, activityDate)
      )
    )
    .get();

  if (existing) return;

  db.insert(streakActivities).values({ userId, activityDate }).run();
}

export function getStreakData(
  userId: number,
  today?: Date
): { currentStreak: number; longestStreak: number } {
  const dates = db
    .select({ activityDate: streakActivities.activityDate })
    .from(streakActivities)
    .where(eq(streakActivities.userId, userId))
    .orderBy(sql`${streakActivities.activityDate} asc`)
    .all()
    .map((r) => r.activityDate);

  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let longestStreak = 1;
  let currentRun = 1;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + "T00:00:00Z");
    const curr = new Date(dates[i] + "T00:00:00Z");
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      currentRun++;
    } else {
      currentRun = 1;
    }
    if (currentRun > longestStreak) {
      longestStreak = currentRun;
    }
  }

  const todayStr = getUtcDateString(today);
  const lastDate = dates[dates.length - 1];

  const lastD = new Date(lastDate + "T00:00:00Z");
  const todayD = new Date(todayStr + "T00:00:00Z");
  const daysSinceLast =
    (todayD.getTime() - lastD.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceLast > 1) {
    return { currentStreak: 0, longestStreak };
  }

  let currentStreak = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    const prev = new Date(dates[i - 1] + "T00:00:00Z");
    const curr = new Date(dates[i] + "T00:00:00Z");
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak };
}
