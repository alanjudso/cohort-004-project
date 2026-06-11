import {
  sum,
  count,
  avg,
  eq,
  and,
  gte,
  min,
  sql,
  desc,
  asc,
} from "drizzle-orm";
import { db } from "~/db";
import {
  purchases,
  enrollments,
  courseRatings,
  courses,
  users,
  modules,
  lessons,
  lessonProgress,
  LessonProgressStatus,
  quizzes,
  quizAttempts,
} from "~/db/schema";

export type AnalyticsPeriod = "7d" | "30d" | "12m" | "all";
export type TimePeriod = AnalyticsPeriod;

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

function getStartDate(period: TimePeriod): string | null {
  return getPeriodStart(period);
}

function generateDailyKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cur <= last) {
    keys.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

function generateMonthlyKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    keys.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`
    );
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}

export function getAnalyticsSummary(
  instructorId: number,
  period: AnalyticsPeriod
) {
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
    averageRating:
      ratingRow?.average != null ? Number(ratingRow.average) : null,
    ratingCount: ratingRow?.total ?? 0,
  };
}

export type RevenueDataPoint = { date: string; revenue: number };

function generateDailyBuckets(days: number): string[] {
  const buckets: string[] = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.push(d.toISOString().slice(0, 10));
  }
  return buckets;
}

function generateMonthlyBuckets(startYearMonth: string): string[] {
  const buckets: string[] = [];
  const now = new Date();
  const [startYear, startMonth] = startYearMonth.split("-").map(Number);
  let year = startYear;
  let month = startMonth;
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  while (true) {
    const label = `${year}-${String(month).padStart(2, "0")}`;
    buckets.push(label);
    if (label === currentYearMonth) break;
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return buckets;
}

export function getRevenueTimeSeries(
  instructorId: number,
  period: AnalyticsPeriod
): RevenueDataPoint[] {
  const isDaily = period === "7d" || period === "30d";
  const periodStart = getPeriodStart(period);

  if (isDaily) {
    const days = period === "7d" ? 7 : 30;
    const rows = db
      .select({
        date: sql<string>`strftime('%Y-%m-%d', ${purchases.createdAt})`.as(
          "date"
        ),
        revenue: sum(purchases.pricePaid),
      })
      .from(purchases)
      .innerJoin(courses, eq(purchases.courseId, courses.id))
      .where(
        and(
          eq(courses.instructorId, instructorId),
          periodStart ? gte(purchases.createdAt, periodStart) : undefined
        )
      )
      .groupBy(sql`strftime('%Y-%m-%d', ${purchases.createdAt})`)
      .all();

    const byDate = new Map<string, number>(
      rows.map((r) => [r.date, Number(r.revenue ?? 0)])
    );
    return generateDailyBuckets(days).map((date) => ({
      date,
      revenue: byDate.get(date) ?? 0,
    }));
  } else {
    let startYearMonth: string;

    if (period === "all") {
      const earliestRow = db
        .select({
          earliest: min(purchases.createdAt),
        })
        .from(purchases)
        .innerJoin(courses, eq(purchases.courseId, courses.id))
        .where(eq(courses.instructorId, instructorId))
        .get();

      if (!earliestRow?.earliest) {
        const now = new Date();
        startYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      } else {
        startYearMonth = earliestRow.earliest.slice(0, 7);
      }
    } else {
      // 12m
      const start = new Date();
      start.setFullYear(start.getFullYear() - 1);
      startYearMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    }

    const rows = db
      .select({
        date: sql<string>`strftime('%Y-%m', ${purchases.createdAt})`.as("date"),
        revenue: sum(purchases.pricePaid),
      })
      .from(purchases)
      .innerJoin(courses, eq(purchases.courseId, courses.id))
      .where(
        and(
          eq(courses.instructorId, instructorId),
          periodStart ? gte(purchases.createdAt, periodStart) : undefined
        )
      )
      .groupBy(sql`strftime('%Y-%m', ${purchases.createdAt})`)
      .all();

    const byMonth = new Map<string, number>(
      rows.map((r) => [r.date, Number(r.revenue ?? 0)])
    );
    return generateMonthlyBuckets(startYearMonth).map((date) => ({
      date,
      revenue: byMonth.get(date) ?? 0,
    }));
  }
}

export type CourseBreakdownRow = {
  courseId: number;
  title: string;
  listPrice: number;
  revenue: number;
  salesCount: number;
  enrollmentCount: number;
  averageRating: number | null;
  ratingCount: number;
};

export function getPerCourseBreakdown(
  instructorId: number,
  period: AnalyticsPeriod
): CourseBreakdownRow[] {
  const periodStart = getPeriodStart(period);

  const allCourses = db
    .select({
      courseId: courses.id,
      title: courses.title,
      listPrice: courses.price,
    })
    .from(courses)
    .where(eq(courses.instructorId, instructorId))
    .all();

  const purchaseRows = db
    .select({
      courseId: purchases.courseId,
      revenue: sum(purchases.pricePaid),
      salesCount: count(),
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        periodStart ? gte(purchases.createdAt, periodStart) : undefined
      )
    )
    .groupBy(purchases.courseId)
    .all();

  const enrollmentRows = db
    .select({
      courseId: enrollments.courseId,
      enrollmentCount: count(),
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        periodStart ? gte(enrollments.enrolledAt, periodStart) : undefined
      )
    )
    .groupBy(enrollments.courseId)
    .all();

  const ratingRows = db
    .select({
      courseId: courseRatings.courseId,
      averageRating: avg(courseRatings.rating),
      ratingCount: count(),
    })
    .from(courseRatings)
    .innerJoin(courses, eq(courseRatings.courseId, courses.id))
    .where(
      and(
        eq(courses.instructorId, instructorId),
        periodStart ? gte(courseRatings.createdAt, periodStart) : undefined
      )
    )
    .groupBy(courseRatings.courseId)
    .all();

  const purchaseMap = new Map(purchaseRows.map((r) => [r.courseId, r]));
  const enrollmentMap = new Map(enrollmentRows.map((r) => [r.courseId, r]));
  const ratingMap = new Map(ratingRows.map((r) => [r.courseId, r]));

  return allCourses.map((c) => {
    const p = purchaseMap.get(c.courseId);
    const e = enrollmentMap.get(c.courseId);
    const r = ratingMap.get(c.courseId);
    return {
      courseId: c.courseId,
      title: c.title,
      listPrice: c.listPrice,
      revenue: Number(p?.revenue ?? 0),
      salesCount: p?.salesCount ?? 0,
      enrollmentCount: e?.enrollmentCount ?? 0,
      averageRating: r?.averageRating != null ? Number(r.averageRating) : null,
      ratingCount: r?.ratingCount ?? 0,
    };
  });
}

// ─── Admin (Platform-Wide) Analytics ───

export interface AdminAnalyticsSummary {
  totalRevenue: number;
  totalEnrollments: number;
  topEarningCourse: { title: string; revenue: number } | null;
}

export function getAdminAnalyticsSummary(opts: {
  period: TimePeriod;
}): AdminAnalyticsSummary {
  const startDate = getStartDate(opts.period);

  const revenueResult = db
    .select({ total: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)` })
    .from(purchases)
    .where(startDate ? sql`${purchases.createdAt} >= ${startDate}` : sql`1=1`)
    .get();

  const enrollmentResult = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(
      startDate ? sql`${enrollments.enrolledAt} >= ${startDate}` : sql`1=1`
    )
    .get();

  const topCourseResult = db
    .select({
      title: courses.title,
      revenue: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(startDate ? sql`${purchases.createdAt} >= ${startDate}` : sql`1=1`)
    .groupBy(courses.id)
    .orderBy(sql`sum(${purchases.pricePaid}) desc`)
    .limit(1)
    .get();

  return {
    totalRevenue: revenueResult?.total ?? 0,
    totalEnrollments: enrollmentResult?.count ?? 0,
    topEarningCourse: topCourseResult
      ? { title: topCourseResult.title, revenue: topCourseResult.revenue }
      : null,
  };
}

export function getAdminRevenueTimeSeries(opts: {
  period: TimePeriod;
}): RevenueDataPoint[] {
  const { period } = opts;
  const now = new Date();
  const useDaily = period === "7d" || period === "30d";

  const startDateStr = getStartDate(period);
  let rangeStart: Date;

  if (startDateStr) {
    rangeStart = new Date(startDateStr);
  } else {
    const earliest = db
      .select({
        minDate: sql<string | null>`min(${purchases.createdAt})`,
      })
      .from(purchases)
      .get();

    if (!earliest?.minDate) return [];
    rangeStart = new Date(earliest.minDate);
  }

  const keys = useDaily
    ? generateDailyKeys(rangeStart, now)
    : generateMonthlyKeys(rangeStart, now);

  const groupExpr = useDaily
    ? sql<string>`substr(${purchases.createdAt}, 1, 10)`
    : sql<string>`substr(${purchases.createdAt}, 1, 7)`;

  const whereClause = startDateStr
    ? sql`${purchases.createdAt} >= ${startDateStr}`
    : sql`1=1`;

  const rows = db
    .select({
      dateKey: groupExpr,
      revenue: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .where(whereClause)
    .groupBy(groupExpr)
    .all();

  const revenueMap = new Map(rows.map((r) => [r.dateKey, r.revenue]));

  return keys.map((key) => ({
    date: key,
    revenue: revenueMap.get(key) ?? 0,
  }));
}

// ─── Per-Course Detail Analytics ───

export type MonthlyEarning = { month: string; revenue: number };

export interface CourseEarnings {
  total: number;
  monthly: MonthlyEarning[];
}

export function getCourseEarnings(courseId: number): CourseEarnings {
  const totalRow = db
    .select({ total: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)` })
    .from(purchases)
    .where(eq(purchases.courseId, courseId))
    .get();

  const rows = db
    .select({
      month: sql<string>`strftime('%Y-%m', ${purchases.createdAt})`.as("month"),
      revenue: sql<number>`coalesce(sum(${purchases.pricePaid}), 0)`,
    })
    .from(purchases)
    .where(eq(purchases.courseId, courseId))
    .groupBy(sql`strftime('%Y-%m', ${purchases.createdAt})`)
    .orderBy(sql`strftime('%Y-%m', ${purchases.createdAt})`)
    .all();

  return {
    total: totalRow?.total ?? 0,
    monthly: rows.map((r) => ({ month: r.month, revenue: r.revenue })),
  };
}

export function getCourseCompletionRate(courseId: number): number {
  const enrollmentCount = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .get();

  const enrolled = enrollmentCount?.count ?? 0;
  if (enrolled === 0) return 0;

  const courseModules = db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .all();

  if (courseModules.length === 0) return 0;

  const courseLessons = db
    .select({ id: lessons.id })
    .from(lessons)
    .where(
      sql`${lessons.moduleId} IN (${sql.join(
        courseModules.map((m) => sql`${m.id}`),
        sql`, `
      )})`
    )
    .all();

  const totalLessons = courseLessons.length;
  if (totalLessons === 0) return 0;

  const enrolledUsers = db
    .select({ userId: enrollments.userId })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .all();

  let completedCount = 0;
  for (const { userId } of enrolledUsers) {
    const completedLessons = db
      .select({ count: sql<number>`count(*)` })
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.status, LessonProgressStatus.Completed),
          sql`${lessonProgress.lessonId} IN (${sql.join(
            courseLessons.map((l) => sql`${l.id}`),
            sql`, `
          )})`
        )
      )
      .get();

    if ((completedLessons?.count ?? 0) >= totalLessons) {
      completedCount++;
    }
  }

  return Math.round((completedCount / enrolled) * 100);
}

export interface DropOffLesson {
  lessonId: number;
  lessonTitle: string;
  moduleTitle: string;
  position: number;
  completedPercent: number;
  isDropOff: boolean;
}

export function getDropOffLessons(courseId: number): DropOffLesson[] {
  const enrollmentCount = db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .get();

  const enrolled = enrollmentCount?.count ?? 0;

  const orderedLessons = db
    .select({
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      moduleTitle: modules.title,
      modulePosition: modules.position,
      lessonPosition: lessons.position,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .orderBy(asc(modules.position), asc(lessons.position))
    .all();

  if (orderedLessons.length === 0 || enrolled === 0) return [];

  const result: DropOffLesson[] = orderedLessons.map((l, idx) => {
    const completedRow = db
      .select({ count: sql<number>`count(*)` })
      .from(lessonProgress)
      .innerJoin(enrollments, eq(lessonProgress.userId, enrollments.userId))
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(lessonProgress.lessonId, l.lessonId),
          eq(lessonProgress.status, LessonProgressStatus.Completed)
        )
      )
      .get();

    return {
      lessonId: l.lessonId,
      lessonTitle: l.lessonTitle,
      moduleTitle: l.moduleTitle,
      position: idx + 1,
      completedPercent:
        enrolled > 0
          ? Math.round(((completedRow?.count ?? 0) / enrolled) * 100)
          : 0,
      isDropOff: false,
    };
  });

  if (result.length >= 2) {
    let maxDrop = 0;
    let maxDropIdx = -1;
    for (let i = 1; i < result.length; i++) {
      const drop = result[i - 1].completedPercent - result[i].completedPercent;
      if (drop > maxDrop && drop >= 10) {
        maxDrop = drop;
        maxDropIdx = i;
      }
    }
    if (maxDropIdx >= 0) {
      result[maxDropIdx].isDropOff = true;
    }
  }

  return result;
}

export interface QuizPerformanceRow {
  quizId: number;
  quizTitle: string;
  lessonTitle: string;
  attemptedCount: number;
  passRate: number;
  avgScore: number;
}

export function getQuizPerformance(courseId: number): QuizPerformanceRow[] {
  const courseQuizzes = db
    .select({
      quizId: quizzes.id,
      quizTitle: quizzes.title,
      lessonTitle: lessons.title,
      modulePosition: modules.position,
      lessonPosition: lessons.position,
    })
    .from(quizzes)
    .innerJoin(lessons, eq(quizzes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .orderBy(asc(modules.position), asc(lessons.position))
    .all();

  return courseQuizzes.map((q) => {
    const bestAttempts = db
      .select({
        userId: quizAttempts.userId,
        bestScore: sql<number>`max(${quizAttempts.score})`,
        passed: sql<number>`max(case when ${quizAttempts.passed} = 1 then 1 else 0 end)`,
      })
      .from(quizAttempts)
      .where(eq(quizAttempts.quizId, q.quizId))
      .groupBy(quizAttempts.userId)
      .all();

    const attemptedCount = bestAttempts.length;
    if (attemptedCount === 0) {
      return {
        quizId: q.quizId,
        quizTitle: q.quizTitle,
        lessonTitle: q.lessonTitle,
        attemptedCount: 0,
        passRate: 0,
        avgScore: 0,
      };
    }

    const passedCount = bestAttempts.filter((a) => a.passed === 1).length;
    const avgScore =
      bestAttempts.reduce((sum, a) => sum + a.bestScore, 0) / attemptedCount;

    return {
      quizId: q.quizId,
      quizTitle: q.quizTitle,
      lessonTitle: q.lessonTitle,
      attemptedCount,
      passRate: Math.round((passedCount / attemptedCount) * 100),
      avgScore: Math.round(avgScore * 100) / 100,
    };
  });
}
