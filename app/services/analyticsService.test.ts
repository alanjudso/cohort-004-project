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

import { getAnalyticsSummary } from "./analyticsService";

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  // ─── Revenue Sum ───

  describe("getAnalyticsSummary - totalRevenue", () => {
    it("sums revenue from all purchases for the instructor's courses", () => {
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 4999, country: "US" }).run();
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 2999, country: "US" }).run();

      const result = getAnalyticsSummary(base.instructor.id, "all");

      expect(result.totalRevenue).toBe(7998);
    });

    it("returns 0 when the instructor has no purchases", () => {
      const result = getAnalyticsSummary(base.instructor.id, "all");

      expect(result.totalRevenue).toBe(0);
    });
  });

  // ─── Enrollment Count ───

  describe("getAnalyticsSummary - totalEnrollments", () => {
    it("counts all enrollments for the instructor's courses", () => {
      const secondUser = testDb.insert(schema.users).values({ name: "User 2", email: "user2@example.com", role: schema.UserRole.Student }).returning().get();

      testDb.insert(schema.enrollments).values({ userId: base.user.id, courseId: base.course.id }).run();
      testDb.insert(schema.enrollments).values({ userId: secondUser.id, courseId: base.course.id }).run();

      const result = getAnalyticsSummary(base.instructor.id, "all");

      expect(result.totalEnrollments).toBe(2);
    });

    it("returns 0 when the instructor has no enrollments", () => {
      const result = getAnalyticsSummary(base.instructor.id, "all");

      expect(result.totalEnrollments).toBe(0);
    });
  });

  // ─── Average Rating ───

  describe("getAnalyticsSummary - averageRating", () => {
    it("averages ratings across all courses for the instructor", () => {
      testDb.insert(schema.courseRatings).values({ userId: base.user.id, courseId: base.course.id, rating: 4, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).run();
      testDb.insert(schema.courseRatings).values({ userId: base.instructor.id, courseId: base.course.id, rating: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).run();

      const result = getAnalyticsSummary(base.instructor.id, "all");

      expect(result.averageRating).toBe(3);
      expect(result.ratingCount).toBe(2);
    });

    it("returns null averageRating when there are no ratings", () => {
      const result = getAnalyticsSummary(base.instructor.id, "all");

      expect(result.averageRating).toBeNull();
      expect(result.ratingCount).toBe(0);
    });
  });

  // ─── Instructor Isolation ───

  describe("getAnalyticsSummary - instructor isolation", () => {
    it("excludes revenue from another instructor's courses", () => {
      const otherInstructor = testDb.insert(schema.users).values({ name: "Other Instructor", email: "other@example.com", role: schema.UserRole.Instructor }).returning().get();
      const otherCourse = testDb.insert(schema.courses).values({ title: "Other Course", slug: "other-course", description: "Other", instructorId: otherInstructor.id, categoryId: base.category.id, status: schema.CourseStatus.Published }).returning().get();

      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: base.course.id, pricePaid: 5000, country: "US" }).run();
      testDb.insert(schema.purchases).values({ userId: base.user.id, courseId: otherCourse.id, pricePaid: 9999, country: "US" }).run();

      const result = getAnalyticsSummary(base.instructor.id, "all");

      expect(result.totalRevenue).toBe(5000);
    });

    it("excludes enrollments from another instructor's courses", () => {
      const otherInstructor = testDb.insert(schema.users).values({ name: "Other Instructor", email: "other2@example.com", role: schema.UserRole.Instructor }).returning().get();
      const otherCourse = testDb.insert(schema.courses).values({ title: "Other Course 2", slug: "other-course-2", description: "Other", instructorId: otherInstructor.id, categoryId: base.category.id, status: schema.CourseStatus.Published }).returning().get();

      testDb.insert(schema.enrollments).values({ userId: base.user.id, courseId: base.course.id }).run();
      testDb.insert(schema.enrollments).values({ userId: base.user.id, courseId: otherCourse.id }).run();

      const result = getAnalyticsSummary(base.instructor.id, "all");

      expect(result.totalEnrollments).toBe(1);
    });

    it("excludes ratings from another instructor's courses", () => {
      const otherInstructor = testDb.insert(schema.users).values({ name: "Other Instructor", email: "other3@example.com", role: schema.UserRole.Instructor }).returning().get();
      const otherCourse = testDb.insert(schema.courses).values({ title: "Other Course 3", slug: "other-course-3", description: "Other", instructorId: otherInstructor.id, categoryId: base.category.id, status: schema.CourseStatus.Published }).returning().get();

      testDb.insert(schema.courseRatings).values({ userId: base.user.id, courseId: base.course.id, rating: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).run();
      testDb.insert(schema.courseRatings).values({ userId: base.user.id, courseId: otherCourse.id, rating: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).run();

      const result = getAnalyticsSummary(base.instructor.id, "all");

      expect(result.averageRating).toBe(5);
      expect(result.ratingCount).toBe(1);
    });
  });
});
