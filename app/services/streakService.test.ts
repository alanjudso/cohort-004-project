import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { recordStreakActivity, getStreakData } from "./streakService";

beforeEach(() => {
  testDb = createTestDb();
  base = seedBaseData(testDb);
});

function utcDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00Z");
}

describe("streakService", () => {
  describe("recordStreakActivity", () => {
    it("records an activity for a date", () => {
      recordStreakActivity(base.user.id, utcDate("2026-06-01"));
      const data = getStreakData(base.user.id, utcDate("2026-06-01"));
      expect(data.currentStreak).toBe(1);
    });

    it("does not duplicate for the same user and date", () => {
      recordStreakActivity(base.user.id, utcDate("2026-06-01"));
      recordStreakActivity(base.user.id, utcDate("2026-06-01"));
      const data = getStreakData(base.user.id, utcDate("2026-06-01"));
      expect(data.currentStreak).toBe(1);
    });
  });

  describe("getStreakData", () => {
    it("returns 0/0 for a user with no activity", () => {
      const data = getStreakData(base.user.id, utcDate("2026-06-01"));
      expect(data.currentStreak).toBe(0);
      expect(data.longestStreak).toBe(0);
    });

    it("tracks consecutive days as a streak", () => {
      recordStreakActivity(base.user.id, utcDate("2026-06-01"));
      recordStreakActivity(base.user.id, utcDate("2026-06-02"));
      recordStreakActivity(base.user.id, utcDate("2026-06-03"));
      const data = getStreakData(base.user.id, utcDate("2026-06-03"));
      expect(data.currentStreak).toBe(3);
      expect(data.longestStreak).toBe(3);
    });

    it("resets current streak after a missed day", () => {
      recordStreakActivity(base.user.id, utcDate("2026-06-01"));
      recordStreakActivity(base.user.id, utcDate("2026-06-02"));
      recordStreakActivity(base.user.id, utcDate("2026-06-04"));
      const data = getStreakData(base.user.id, utcDate("2026-06-04"));
      expect(data.currentStreak).toBe(1);
      expect(data.longestStreak).toBe(2);
    });

    it("resets current streak when today is more than 1 day after last activity", () => {
      recordStreakActivity(base.user.id, utcDate("2026-06-01"));
      recordStreakActivity(base.user.id, utcDate("2026-06-02"));
      const data = getStreakData(base.user.id, utcDate("2026-06-05"));
      expect(data.currentStreak).toBe(0);
      expect(data.longestStreak).toBe(2);
    });

    it("keeps current streak active if today equals last activity date", () => {
      recordStreakActivity(base.user.id, utcDate("2026-06-01"));
      recordStreakActivity(base.user.id, utcDate("2026-06-02"));
      const data = getStreakData(base.user.id, utcDate("2026-06-02"));
      expect(data.currentStreak).toBe(2);
    });

    it("keeps current streak active if today is one day after last activity", () => {
      recordStreakActivity(base.user.id, utcDate("2026-06-01"));
      recordStreakActivity(base.user.id, utcDate("2026-06-02"));
      const data = getStreakData(base.user.id, utcDate("2026-06-03"));
      expect(data.currentStreak).toBe(2);
    });

    it("tracks longest streak across multiple separate streaks", () => {
      recordStreakActivity(base.user.id, utcDate("2026-06-01"));
      recordStreakActivity(base.user.id, utcDate("2026-06-02"));
      recordStreakActivity(base.user.id, utcDate("2026-06-03"));
      recordStreakActivity(base.user.id, utcDate("2026-06-03"));
      // gap
      recordStreakActivity(base.user.id, utcDate("2026-06-06"));
      recordStreakActivity(base.user.id, utcDate("2026-06-07"));
      const data = getStreakData(base.user.id, utcDate("2026-06-07"));
      expect(data.currentStreak).toBe(2);
      expect(data.longestStreak).toBe(3);
    });

    it("isolates streaks between users", () => {
      recordStreakActivity(base.user.id, utcDate("2026-06-01"));
      recordStreakActivity(base.user.id, utcDate("2026-06-02"));
      recordStreakActivity(base.instructor.id, utcDate("2026-06-01"));

      const userData = getStreakData(base.user.id, utcDate("2026-06-02"));
      const instrData = getStreakData(
        base.instructor.id,
        utcDate("2026-06-02")
      );

      expect(userData.currentStreak).toBe(2);
      expect(instrData.currentStreak).toBe(1);
    });
  });
});
