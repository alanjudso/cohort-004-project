import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import {
  XpSourceType,
  LessonProgressStatus,
  modules,
  lessons,
  lessonProgress,
} from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { awardXp, getTotalXp, checkModuleCompleted } from "./xpService";

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

  describe("checkModuleCompleted", () => {
    function createModuleWithLessons(count: number) {
      const mod = testDb
        .insert(modules)
        .values({ courseId: base.course.id, title: "Test Module", position: 1 })
        .returning()
        .get();

      const created = [];
      for (let i = 0; i < count; i++) {
        const lesson = testDb
          .insert(lessons)
          .values({
            moduleId: mod.id,
            title: `Lesson ${i + 1}`,
            position: i + 1,
          })
          .returning()
          .get();
        created.push(lesson);
      }
      return { mod, lessons: created };
    }

    it("returns not completed when no lessons exist", () => {
      const mod = testDb
        .insert(modules)
        .values({
          courseId: base.course.id,
          title: "Empty Module",
          position: 1,
        })
        .returning()
        .get();

      const result = checkModuleCompleted(base.user.id, mod.id);
      expect(result.completed).toBe(false);
      expect(result.lessonCount).toBe(0);
      expect(result.totalXp).toBe(0);
    });

    it("returns not completed when no lessons are completed", () => {
      const { mod } = createModuleWithLessons(3);
      const result = checkModuleCompleted(base.user.id, mod.id);
      expect(result.completed).toBe(false);
      expect(result.lessonCount).toBe(3);
      expect(result.totalXp).toBe(30);
    });

    it("returns not completed when only some lessons are completed", () => {
      const { mod, lessons: moduleLessons } = createModuleWithLessons(3);
      testDb
        .insert(lessonProgress)
        .values({
          userId: base.user.id,
          lessonId: moduleLessons[0].id,
          status: LessonProgressStatus.Completed,
        })
        .run();

      const result = checkModuleCompleted(base.user.id, mod.id);
      expect(result.completed).toBe(false);
    });

    it("returns completed when all lessons are completed", () => {
      const { mod, lessons: moduleLessons } = createModuleWithLessons(4);
      for (const lesson of moduleLessons) {
        testDb
          .insert(lessonProgress)
          .values({
            userId: base.user.id,
            lessonId: lesson.id,
            status: LessonProgressStatus.Completed,
          })
          .run();
      }

      const result = checkModuleCompleted(base.user.id, mod.id);
      expect(result.completed).toBe(true);
      expect(result.lessonCount).toBe(4);
      expect(result.totalXp).toBe(40);
    });

    it("does not count in-progress lessons as completed", () => {
      const { mod, lessons: moduleLessons } = createModuleWithLessons(2);
      testDb
        .insert(lessonProgress)
        .values({
          userId: base.user.id,
          lessonId: moduleLessons[0].id,
          status: LessonProgressStatus.Completed,
        })
        .run();
      testDb
        .insert(lessonProgress)
        .values({
          userId: base.user.id,
          lessonId: moduleLessons[1].id,
          status: LessonProgressStatus.InProgress,
        })
        .run();

      const result = checkModuleCompleted(base.user.id, mod.id);
      expect(result.completed).toBe(false);
    });

    it("is scoped to the specific user", () => {
      const { mod, lessons: moduleLessons } = createModuleWithLessons(2);
      for (const lesson of moduleLessons) {
        testDb
          .insert(lessonProgress)
          .values({
            userId: base.instructor.id,
            lessonId: lesson.id,
            status: LessonProgressStatus.Completed,
          })
          .run();
      }

      const result = checkModuleCompleted(base.user.id, mod.id);
      expect(result.completed).toBe(false);
    });
  });
});
