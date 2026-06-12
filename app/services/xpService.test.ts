import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { awardXp, getTotalXp } from "./xpService";

function createLesson(courseId: number) {
  const mod = testDb
    .insert(schema.modules)
    .values({ courseId, title: "Module 1", position: 1 })
    .returning()
    .get();

  return testDb
    .insert(schema.lessons)
    .values({ moduleId: mod.id, title: "Lesson 1", position: 1 })
    .returning()
    .get();
}

describe("xpService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("awardXp", () => {
    it("awards XP for a new source", () => {
      const lesson = createLesson(base.course.id);

      const event = awardXp({
        userId: base.user.id,
        amount: 10,
        sourceType: "lesson_completion",
        sourceId: lesson.id,
      });

      expect(event).toBeDefined();
      expect(event.amount).toBe(10);
      expect(event.userId).toBe(base.user.id);
      expect(event.sourceType).toBe("lesson_completion");
      expect(event.sourceId).toBe(lesson.id);
    });

    it("does not award duplicate XP for the same source", () => {
      const lesson = createLesson(base.course.id);

      const first = awardXp({
        userId: base.user.id,
        amount: 10,
        sourceType: "lesson_completion",
        sourceId: lesson.id,
      });

      const second = awardXp({
        userId: base.user.id,
        amount: 10,
        sourceType: "lesson_completion",
        sourceId: lesson.id,
      });

      expect(second.id).toBe(first.id);
      expect(getTotalXp(base.user.id)).toBe(10);
    });

    it("allows different source types for the same source ID", () => {
      const lesson = createLesson(base.course.id);

      awardXp({
        userId: base.user.id,
        amount: 10,
        sourceType: "lesson_completion",
        sourceId: lesson.id,
      });

      awardXp({
        userId: base.user.id,
        amount: 5,
        sourceType: "quiz_pass",
        sourceId: lesson.id,
      });

      expect(getTotalXp(base.user.id)).toBe(15);
    });

    it("allows same source type for different users", () => {
      const lesson = createLesson(base.course.id);

      const student2 = testDb
        .insert(schema.users)
        .values({
          name: "Student 2",
          email: "student2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      awardXp({
        userId: base.user.id,
        amount: 10,
        sourceType: "lesson_completion",
        sourceId: lesson.id,
      });

      awardXp({
        userId: student2.id,
        amount: 10,
        sourceType: "lesson_completion",
        sourceId: lesson.id,
      });

      expect(getTotalXp(base.user.id)).toBe(10);
      expect(getTotalXp(student2.id)).toBe(10);
    });
  });

  describe("getTotalXp", () => {
    it("returns 0 when user has no XP events", () => {
      expect(getTotalXp(base.user.id)).toBe(0);
    });

    it("sums XP across multiple events", () => {
      const lesson1 = createLesson(base.course.id);

      const mod2 = testDb
        .insert(schema.modules)
        .values({ courseId: base.course.id, title: "Module 2", position: 2 })
        .returning()
        .get();
      const lesson2 = testDb
        .insert(schema.lessons)
        .values({ moduleId: mod2.id, title: "Lesson 2", position: 1 })
        .returning()
        .get();

      awardXp({
        userId: base.user.id,
        amount: 10,
        sourceType: "lesson_completion",
        sourceId: lesson1.id,
      });

      awardXp({
        userId: base.user.id,
        amount: 10,
        sourceType: "lesson_completion",
        sourceId: lesson2.id,
      });

      expect(getTotalXp(base.user.id)).toBe(20);
    });
  });
});
