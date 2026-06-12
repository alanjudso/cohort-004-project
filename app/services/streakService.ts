import { eq, sql } from "drizzle-orm";
import { db } from "~/db";
import { streakActivities } from "~/db/schema";

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export function recordStreakActivity(userId: number) {
  const today = getTodayUTC();

  const existing = db
    .select()
    .from(streakActivities)
    .where(
      sql`${streakActivities.userId} = ${userId} AND ${streakActivities.activityDate} = ${today}`
    )
    .get();

  if (existing) return existing;

  return db
    .insert(streakActivities)
    .values({ userId, activityDate: today })
    .returning()
    .get();
}

export function getStreakData(userId: number): {
  currentStreak: number;
  longestStreak: number;
} {
  const rows = db
    .select({ activityDate: streakActivities.activityDate })
    .from(streakActivities)
    .where(eq(streakActivities.userId, userId))
    .orderBy(sql`${streakActivities.activityDate} DESC`)
    .all();

  if (rows.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const dates = rows.map((r) => r.activityDate);

  const today = getTodayUTC();
  const yesterday = shiftDate(today, -1);

  let currentStreak = 0;
  if (dates[0] === today || dates[0] === yesterday) {
    currentStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const expected = shiftDate(dates[i - 1], -1);
      if (dates[i] === expected) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  let longestStreak = 1;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const expected = shiftDate(dates[i - 1], -1);
    if (dates[i] === expected) {
      streak++;
      if (streak > longestStreak) longestStreak = streak;
    } else {
      streak = 1;
    }
  }

  if (currentStreak > longestStreak) longestStreak = currentStreak;

  return { currentStreak, longestStreak };
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
