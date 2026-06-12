import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { recordStreakActivity, getStreakData } from "./streakService";

function insertStreakActivity(userId: number, date: string) {
  testDb
    .insert(schema.streakActivities)
    .values({ userId, activityDate: date })
    .run();
}

describe("streakService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("recordStreakActivity", () => {
    it("records a streak activity for today", () => {
      vi.setSystemTime(new Date("2026-06-12T10:00:00Z"));
      const result = recordStreakActivity(base.user.id);
      expect(result.activityDate).toBe("2026-06-12");
      expect(result.userId).toBe(base.user.id);
    });

    it("does not create duplicate rows for the same day", () => {
      vi.setSystemTime(new Date("2026-06-12T10:00:00Z"));
      recordStreakActivity(base.user.id);
      const second = recordStreakActivity(base.user.id);

      const all = testDb.select().from(schema.streakActivities).all();
      expect(all.length).toBe(1);
      expect(second.activityDate).toBe("2026-06-12");
    });
  });

  describe("getStreakData", () => {
    it("returns 0/0 for a user with no activity", () => {
      vi.setSystemTime(new Date("2026-06-12T10:00:00Z"));
      const result = getStreakData(base.user.id);
      expect(result).toEqual({ currentStreak: 0, longestStreak: 0 });
    });

    it("returns 1-day streak when only today has activity", () => {
      vi.setSystemTime(new Date("2026-06-12T10:00:00Z"));
      insertStreakActivity(base.user.id, "2026-06-12");
      const result = getStreakData(base.user.id);
      expect(result).toEqual({ currentStreak: 1, longestStreak: 1 });
    });

    it("returns active streak for consecutive days ending today", () => {
      vi.setSystemTime(new Date("2026-06-12T10:00:00Z"));
      insertStreakActivity(base.user.id, "2026-06-10");
      insertStreakActivity(base.user.id, "2026-06-11");
      insertStreakActivity(base.user.id, "2026-06-12");
      const result = getStreakData(base.user.id);
      expect(result).toEqual({ currentStreak: 3, longestStreak: 3 });
    });

    it("returns active streak for consecutive days ending yesterday", () => {
      vi.setSystemTime(new Date("2026-06-12T10:00:00Z"));
      insertStreakActivity(base.user.id, "2026-06-10");
      insertStreakActivity(base.user.id, "2026-06-11");
      const result = getStreakData(base.user.id);
      expect(result).toEqual({ currentStreak: 2, longestStreak: 2 });
    });

    it("resets current streak when a day is missed", () => {
      vi.setSystemTime(new Date("2026-06-12T10:00:00Z"));
      insertStreakActivity(base.user.id, "2026-06-08");
      insertStreakActivity(base.user.id, "2026-06-09");
      insertStreakActivity(base.user.id, "2026-06-10");
      // gap on 2026-06-11
      insertStreakActivity(base.user.id, "2026-06-12");
      const result = getStreakData(base.user.id);
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(3);
    });

    it("returns 0 current streak when last activity is more than 1 day ago", () => {
      vi.setSystemTime(new Date("2026-06-12T10:00:00Z"));
      insertStreakActivity(base.user.id, "2026-06-09");
      insertStreakActivity(base.user.id, "2026-06-10");
      const result = getStreakData(base.user.id);
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(2);
    });

    it("handles a single-day streak in the past", () => {
      vi.setSystemTime(new Date("2026-06-12T10:00:00Z"));
      insertStreakActivity(base.user.id, "2026-06-05");
      const result = getStreakData(base.user.id);
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(1);
    });

    it("tracks longest streak separately from current streak", () => {
      vi.setSystemTime(new Date("2026-06-12T10:00:00Z"));
      // old 5-day streak
      insertStreakActivity(base.user.id, "2026-06-01");
      insertStreakActivity(base.user.id, "2026-06-02");
      insertStreakActivity(base.user.id, "2026-06-03");
      insertStreakActivity(base.user.id, "2026-06-04");
      insertStreakActivity(base.user.id, "2026-06-05");
      // gap
      // new 2-day streak
      insertStreakActivity(base.user.id, "2026-06-11");
      insertStreakActivity(base.user.id, "2026-06-12");
      const result = getStreakData(base.user.id);
      expect(result.currentStreak).toBe(2);
      expect(result.longestStreak).toBe(5);
    });
  });
});
