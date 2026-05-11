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
  getAdminRevenueTimeSeries,
  type TimePeriod,
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
    it("returns zeros when no data exists", () => {
      const result = getAdminAnalyticsSummary({ period: "all" });

      expect(result.totalRevenue).toBe(0);
      expect(result.totalEnrollments).toBe(0);
      expect(result.topEarningCourse).toBeNull();
    });

    it("aggregates revenue across all instructors", () => {
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
          description: "Another course",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
          price: 9999,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 4999,
            country: "US",
          },
          {
            userId: base.user.id,
            courseId: otherCourse.id,
            pricePaid: 9999,
            country: "US",
          },
        ])
        .run();

      const result = getAdminAnalyticsSummary({ period: "all" });

      expect(result.totalRevenue).toBe(14998);
    });

    it("aggregates enrollments across all courses", () => {
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
          description: "Another course",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
          price: 9999,
        })
        .returning()
        .get();

      testDb
        .insert(schema.enrollments)
        .values([
          { userId: base.user.id, courseId: base.course.id },
          { userId: base.user.id, courseId: otherCourse.id },
          { userId: otherInstructor.id, courseId: base.course.id },
        ])
        .run();

      const result = getAdminAnalyticsSummary({ period: "all" });

      expect(result.totalEnrollments).toBe(3);
    });

    it("identifies the top earning course", () => {
      const course2 = testDb
        .insert(schema.courses)
        .values({
          title: "Premium Course",
          slug: "premium-course",
          description: "Expensive",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
          price: 9999,
        })
        .returning()
        .get();

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 2000,
            country: "US",
          },
          {
            userId: base.user.id,
            courseId: course2.id,
            pricePaid: 9999,
            country: "US",
          },
        ])
        .run();

      const result = getAdminAnalyticsSummary({ period: "all" });

      expect(result.topEarningCourse).toEqual({
        title: "Premium Course",
        revenue: 9999,
      });
    });

    it("respects time period filter", () => {
      const now = new Date();
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(now.getDate() - 3);
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(now.getDate() - 10);

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 4999,
            country: "US",
            createdAt: threeDaysAgo.toISOString(),
          },
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 2500,
            country: "US",
            createdAt: tenDaysAgo.toISOString(),
          },
        ])
        .run();

      const result = getAdminAnalyticsSummary({ period: "7d" });

      expect(result.totalRevenue).toBe(4999);
    });
  });

  // ─── Admin Revenue Time Series ───

  describe("getAdminRevenueTimeSeries", () => {
    it("returns empty array when no purchases exist for all period", () => {
      const result = getAdminRevenueTimeSeries({ period: "all" });
      expect(result).toEqual([]);
    });

    it("returns daily data points for 7d period across all instructors", () => {
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
          description: "Another course",
          instructorId: otherInstructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
          price: 9999,
        })
        .returning()
        .get();

      const now = new Date();
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(now.getDate() - 2);

      testDb
        .insert(schema.purchases)
        .values([
          {
            userId: base.user.id,
            courseId: base.course.id,
            pricePaid: 4999,
            country: "US",
            createdAt: twoDaysAgo.toISOString(),
          },
          {
            userId: base.user.id,
            courseId: otherCourse.id,
            pricePaid: 9999,
            country: "US",
            createdAt: twoDaysAgo.toISOString(),
          },
        ])
        .run();

      const result = getAdminRevenueTimeSeries({ period: "7d" });

      expect(result.length).toBe(8);
      const totalRevenue = result.reduce((sum, p) => sum + p.revenue, 0);
      expect(totalRevenue).toBe(14998);
    });

    it("returns monthly data points for 12m period", () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(now.getMonth() - 6);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: sixMonthsAgo.toISOString(),
        })
        .run();

      const result = getAdminRevenueTimeSeries({ period: "12m" });

      expect(result.length).toBe(13);
      expect(result[0].date).toMatch(/^\d{4}-\d{2}$/);
    });

    it("fills zero-revenue periods with $0 data points", () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now);
      fiveDaysAgo.setDate(now.getDate() - 5);

      testDb
        .insert(schema.purchases)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
          pricePaid: 4999,
          country: "US",
          createdAt: fiveDaysAgo.toISOString(),
        })
        .run();

      const result = getAdminRevenueTimeSeries({ period: "7d" });

      const zeroDays = result.filter((p) => p.revenue === 0);
      expect(zeroDays.length).toBe(7);

      const purchaseDay = result.find((p) => p.revenue > 0);
      expect(purchaseDay?.revenue).toBe(4999);
    });
  });
});
