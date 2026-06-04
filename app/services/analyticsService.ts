import { sum, count, avg, eq, and, gte } from "drizzle-orm";
import { db } from "~/db";
import { purchases, enrollments, courseRatings, courses } from "~/db/schema";

export type AnalyticsPeriod = "7d" | "30d" | "12m" | "all";

const VALID_PERIODS = new Set<string>(["7d", "30d", "12m", "all"]);

export function parsePeriod(value: string | null): AnalyticsPeriod {
  if (value && VALID_PERIODS.has(value)) return value as AnalyticsPeriod;
  return "30d";
}

function getPeriodStart(period: AnalyticsPeriod): string | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "7d") now.setDate(now.getDate() - 7);
  else if (period === "30d") now.setDate(now.getDate() - 30);
  else if (period === "12m") now.setFullYear(now.getFullYear() - 1);
  return now.toISOString();
}

export function getAnalyticsSummary(instructorId: number, period: AnalyticsPeriod) {
  const periodStart = getPeriodStart(period);

  const revenueRow = db
    .select({ total: sum(purchases.pricePaid) })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        periodStart ? gte(purchases.createdAt, periodStart) : undefined
      )
    )
    .get();

  const enrollmentRow = db
    .select({ total: count() })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        periodStart ? gte(enrollments.enrolledAt, periodStart) : undefined
      )
    )
    .get();

  const ratingRow = db
    .select({ average: avg(courseRatings.rating), total: count() })
    .from(courseRatings)
    .innerJoin(courses, eq(courseRatings.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        periodStart ? gte(courseRatings.createdAt, periodStart) : undefined
      )
    )
    .get();

  return {
    totalRevenue: Number(revenueRow?.total ?? 0),
    totalEnrollments: enrollmentRow?.total ?? 0,
    averageRating: ratingRow?.average != null ? Number(ratingRow.average) : null,
    ratingCount: ratingRow?.total ?? 0,
  };
}
