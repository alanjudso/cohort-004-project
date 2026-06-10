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

import {
  getAnalyticsSummary,
  getRevenueTimeSeries,
  getPerCourseBreakdown,
  getAdminAnalyticsSummary,
} from "./analyticsService";

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  // ─── Revenue Sum ───

  describe("getAnalyticsSummary - totalRevenue", () => {
    it("sums revenue from all purchases for the instructor's courses", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 2999,
          country: "US",
        })
        .run();

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
      const secondUser = testDb
        .insert(schema.users)
        .values({
          name: "User 2",
          email: "user2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: base.course.id })
        .run();
      testDb
        .insert(schema.enrollments)
        .values({ userId: secondUser.id, courseId: base.course.id })
        .run();

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
      testDb
        .insert(schema.courseRatings)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          rating: 4,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .run();
      testDb
        .insert(schema.courseRatings)
        .values({
          userId: base.instructor.id,
          courseId: base.course.id,
          rating: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .run();

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

  // ─── Period Boundary Filtering ───

  describe("getAnalyticsSummary - period boundary filtering", () => {
    function daysAgo(n: number) {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString();
    }

    it("includes a purchase created within the 30d window in totalRevenue", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 3000,
          country: "US",
          createdAt: daysAgo(15),
        })
        .run();

      const result = getAnalyticsSummary(base.instructor.id, "30d");

      expect(result.totalRevenue).toBe(3000);
    });

    it("excludes a purchase created outside the 30d window from totalRevenue", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 3000,
          country: "US",
          createdAt: daysAgo(45),
        })
        .run();

      const result = getAnalyticsSummary(base.instructor.id, "30d");

      expect(result.totalRevenue).toBe(0);
    });

    it("includes an enrollment created within the 7d window in totalEnrollments", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: daysAgo(3),
        })
        .run();

      const result = getAnalyticsSummary(base.instructor.id, "7d");

      expect(result.totalEnrollments).toBe(1);
    });

    it("excludes an enrollment created outside the 7d window from totalEnrollments", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: daysAgo(10),
        })
        .run();

      const result = getAnalyticsSummary(base.instructor.id, "7d");

      expect(result.totalEnrollments).toBe(0);
    });
  });

  // ─── Instructor Isolation ───

  describe("getAnalyticsSummary - instructor isolation", () => {
    it("excludes revenue from another instructor's courses", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Other",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 5000,
          country: "US",
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: otherCourse.id,
          pricePaid: 9999,
          country: "US",
        })
        .run();

      const result = getAnalyticsSummary(base.instructor.id, "all");

      expect(result.totalRevenue).toBe(5000);
    });

    it("excludes enrollments from another instructor's courses", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other2@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course 2",
          slug: "other-course-2",
          description: "Other",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: base.course.id })
        .run();
      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: otherCourse.id })
        .run();

      const result = getAnalyticsSummary(base.instructor.id, "all");

      expect(result.totalEnrollments).toBe(1);
    });

    it("excludes ratings from another instructor's courses", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other3@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course 3",
          slug: "other-course-3",
          description: "Other",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.courseRatings)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          rating: 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .run();
      testDb
        .insert(schema.courseRatings)
        .values({
          userId: base.user.id,
          courseId: otherCourse.id,
          rating: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .run();

      const result = getAnalyticsSummary(base.instructor.id, "all");

      expect(result.averageRating).toBe(5);
      expect(result.ratingCount).toBe(1);
    });
  });

  // ─── Revenue Time Series ───

  describe("getRevenueTimeSeries", () => {
    function daysAgo(n: number) {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString();
    }

    it("30d: returns 31 buckets (today + 30 days back)", () => {
      const result = getRevenueTimeSeries(base.instructor.id, "30d");

      expect(result).toHaveLength(31);
    });

    it("7d: returns 8 buckets (today + 7 days back)", () => {
      const result = getRevenueTimeSeries(base.instructor.id, "7d");

      expect(result).toHaveLength(8);
    });

    it("30d: a purchase today appears in today's bucket", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 5000,
          country: "US",
        })
        .run();

      const result = getRevenueTimeSeries(base.instructor.id, "30d");
      const today = new Date().toISOString().slice(0, 10);
      const todayBucket = result.find((r) => r.date === today);

      expect(todayBucket?.revenue).toBe(5000);
    });

    it("30d: days with no purchases have revenue 0", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 5000,
          country: "US",
        })
        .run();

      const result = getRevenueTimeSeries(base.instructor.id, "30d");
      const zeroDays = result.filter((r) => r.revenue === 0);

      expect(zeroDays.length).toBeGreaterThan(0);
    });

    it("30d: a purchase outside the window is excluded", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 9999,
          country: "US",
          createdAt: daysAgo(45),
        })
        .run();

      const result = getRevenueTimeSeries(base.instructor.id, "30d");
      const totalRevenue = result.reduce((sum, r) => sum + r.revenue, 0);

      expect(totalRevenue).toBe(0);
    });

    it("12m: returns monthly buckets including current month", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4000,
          country: "US",
        })
        .run();

      const result = getRevenueTimeSeries(base.instructor.id, "12m");
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const currentBucket = result.find((r) => r.date === currentMonth);

      expect(currentBucket).toBeDefined();
      expect(currentBucket?.revenue).toBe(4000);
    });

    it("all: starts from the month of the earliest purchase", () => {
      const pastDate = "2024-03-15T10:00:00.000Z";
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 1000,
          country: "US",
          createdAt: pastDate,
        })
        .run();

      const result = getRevenueTimeSeries(base.instructor.id, "all");

      expect(result[0].date).toBe("2024-03");
    });

    it("all: with no purchases returns single bucket for current month with revenue 0", () => {
      const result = getRevenueTimeSeries(base.instructor.id, "all");
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe(currentMonth);
      expect(result[0].revenue).toBe(0);
    });
  });

  // ─── Per-Course Breakdown ───

  describe("getPerCourseBreakdown", () => {
    function daysAgo(n: number) {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString();
    }

    it("returns a row for each course owned by the instructor", () => {
      const secondCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course",
          description: "desc",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
          price: 2999,
        })
        .returning()
        .get();

      const result = getPerCourseBreakdown(base.instructor.id, "all");

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.courseId)).toContain(base.course.id);
      expect(result.map((r) => r.courseId)).toContain(secondCourse.id);
    });

    it("correctly attributes revenue to the right course", () => {
      const secondCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Second Course",
          slug: "second-course-2",
          description: "desc",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
          price: 2999,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 5000,
          country: "US",
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: secondCourse.id,
          pricePaid: 3000,
          country: "US",
        })
        .run();

      const result = getPerCourseBreakdown(base.instructor.id, "all");
      const firstRow = result.find((r) => r.courseId === base.course.id);
      const secondRow = result.find((r) => r.courseId === secondCourse.id);

      expect(firstRow?.revenue).toBe(5000);
      expect(secondRow?.revenue).toBe(3000);
    });

    it("a course with no sales shows revenue 0 and salesCount 0", () => {
      const result = getPerCourseBreakdown(base.instructor.id, "all");
      const row = result.find((r) => r.courseId === base.course.id);

      expect(row?.revenue).toBe(0);
      expect(row?.salesCount).toBe(0);
    });

    it("excludes purchases outside the selected period", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 9999,
          country: "US",
          createdAt: daysAgo(45),
        })
        .run();

      const result = getPerCourseBreakdown(base.instructor.id, "30d");
      const row = result.find((r) => r.courseId === base.course.id);

      expect(row?.revenue).toBe(0);
      expect(row?.salesCount).toBe(0);
    });

    it("does not include courses from other instructors", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other",
          email: "other-breakdown@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();
      testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-bd-course",
          description: "desc",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .run();

      const result = getPerCourseBreakdown(base.instructor.id, "all");

      expect(result.every((r) => r.courseId === base.course.id)).toBe(true);
    });

    it("includes list price from courses.price", () => {
      testDb
        .insert(schema.courses)
        .values({
          title: "Priced Course",
          slug: "priced-course",
          description: "desc",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
          price: 4999,
        })
        .run();

      const result = getPerCourseBreakdown(base.instructor.id, "all");
      const pricedRow = result.find((r) => r.title === "Priced Course");

      expect(pricedRow?.listPrice).toBe(4999);
    });
  });

  // ─── Admin Analytics Summary ───

  describe("getAdminAnalyticsSummary", () => {
    function daysAgo(n: number) {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString();
    }

    it("sums revenue across all instructors", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other-admin@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-admin-course",
          description: "desc",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 5000,
          country: "US",
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: otherCourse.id,
          pricePaid: 3000,
          country: "US",
        })
        .run();

      const result = getAdminAnalyticsSummary("all");

      expect(result.totalRevenue).toBe(8000);
    });

    it("counts enrollments across all instructors", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other-admin2@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course 2",
          slug: "other-admin-course-2",
          description: "desc",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: base.course.id })
        .run();
      testDb
        .insert(schema.enrollments)
        .values({ userId: base.user.id, courseId: otherCourse.id })
        .run();

      const result = getAdminAnalyticsSummary("all");

      expect(result.totalEnrollments).toBe(2);
    });

    it("returns the top earning course", () => {
      const otherInstructor = testDb
        .insert(schema.users)
        .values({
          name: "Other Instructor",
          email: "other-admin3@example.com",
          role: schema.UserRole.Instructor,
        })
        .returning()
        .get();
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Big Earner",
          slug: "big-earner",
          description: "desc",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 1000,
          country: "US",
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: otherCourse.id,
          pricePaid: 9000,
          country: "US",
        })
        .run();

      const result = getAdminAnalyticsSummary("all");

      expect(result.topCourse).toEqual({ title: "Big Earner", revenue: 9000 });
    });

    it("returns null topCourse when there are no purchases", () => {
      const result = getAdminAnalyticsSummary("all");

      expect(result.topCourse).toBeNull();
    });

    it("returns 0 revenue and 0 enrollments when there is no data", () => {
      const result = getAdminAnalyticsSummary("all");

      expect(result.totalRevenue).toBe(0);
      expect(result.totalEnrollments).toBe(0);
    });

    it("respects the time period filter", () => {
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 5000,
          country: "US",
          createdAt: daysAgo(3),
        })
        .run();
      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 2000,
          country: "US",
          createdAt: daysAgo(45),
        })
        .run();

      const result = getAdminAnalyticsSummary("30d");

      expect(result.totalRevenue).toBe(5000);
    });

    it("respects the time period filter for enrollments", () => {
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: daysAgo(3),
        })
        .run();
      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: daysAgo(45),
        })
        .run();

      const result = getAdminAnalyticsSummary("7d");

      expect(result.totalEnrollments).toBe(1);
    });
  });
});
