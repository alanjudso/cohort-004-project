import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import { XpSourceType } from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { awardXp, getTotalXp } from "./xpService";

beforeEach(() => {
  testDb = createTestDb();
  base = seedBaseData(testDb);
});

describe("xpService", () => {
  describe("awardXp", () => {
    it("awards XP and returns true", () => {
      const result = awardXp({
        userId: base.user.id,
        amount: 10,
        sourceType: XpSourceType.LessonComplete,
        sourceId: 1,
      });
      expect(result).toBe(true);
      expect(getTotalXp(base.user.id)).toBe(10);
    });

    it("prevents duplicate awards for the same source", () => {
      awardXp({
        userId: base.user.id,
        amount: 10,
        sourceType: XpSourceType.LessonComplete,
        sourceId: 1,
      });
      const result = awardXp({
        userId: base.user.id,
        amount: 10,
        sourceType: XpSourceType.LessonComplete,
        sourceId: 1,
      });
      expect(result).toBe(false);
      expect(getTotalXp(base.user.id)).toBe(10);
    });

    it("allows different source types for the same source ID", () => {
      awardXp({
        userId: base.user.id,
        amount: 10,
        sourceType: XpSourceType.LessonComplete,
        sourceId: 1,
      });
      awardXp({
        userId: base.user.id,
        amount: 5,
        sourceType: XpSourceType.QuizPass,
        sourceId: 1,
      });
      expect(getTotalXp(base.user.id)).toBe(15);
    });

    it("tracks XP per user independently", () => {
      awardXp({
        userId: base.user.id,
        amount: 10,
        sourceType: XpSourceType.LessonComplete,
        sourceId: 1,
      });
      awardXp({
        userId: base.instructor.id,
        amount: 10,
        sourceType: XpSourceType.LessonComplete,
        sourceId: 1,
      });
      expect(getTotalXp(base.user.id)).toBe(10);
      expect(getTotalXp(base.instructor.id)).toBe(10);
    });
  });

  describe("getTotalXp", () => {
    it("returns 0 for a user with no XP", () => {
      expect(getTotalXp(base.user.id)).toBe(0);
    });

    it("sums all XP events for a user", () => {
      awardXp({
        userId: base.user.id,
        amount: 10,
        sourceType: XpSourceType.LessonComplete,
        sourceId: 1,
      });
      awardXp({
        userId: base.user.id,
        amount: 10,
        sourceType: XpSourceType.LessonComplete,
        sourceId: 2,
      });
      awardXp({
        userId: base.user.id,
        amount: 5,
        sourceType: XpSourceType.QuizPass,
        sourceId: 3,
      });
      expect(getTotalXp(base.user.id)).toBe(25);
    });
  });
});
