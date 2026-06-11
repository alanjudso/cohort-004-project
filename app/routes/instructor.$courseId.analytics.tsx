import { Link } from "react-router";
import { data, isRouteErrorResponse } from "react-router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  ArrowLeft,
  DollarSign,
  Users,
  CheckCircle,
  TrendingDown,
} from "lucide-react";
import type { Route } from "./+types/instructor.$courseId.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { getCourseById } from "~/services/courseService";
import { getEnrollmentCountForCourse } from "~/services/enrollmentService";
import { UserRole } from "~/db/schema";
import { formatPrice } from "~/lib/utils";
import {
  getCourseEarnings,
  getCourseCompletionRate,
  getDropOffLessons,
  getQuizPerformance,
} from "~/services/analyticsService";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Course";
  return [
    { title: `Analytics: ${title} — Cadence` },
    { name: "description", content: `Analytics for ${title}` },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (
    !user ||
    (user.role !== UserRole.Instructor && user.role !== UserRole.Admin)
  ) {
    throw data("Only instructors and admins can access this page.", {
      status: 403,
    });
  }

  const courseId = parseInt(params.courseId, 10);
  if (isNaN(courseId)) {
    throw data("Invalid course ID.", { status: 400 });
  }

  const course = getCourseById(courseId);

  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  if (course.instructorId !== currentUserId && user.role !== UserRole.Admin) {
    throw data("You can only view analytics for your own courses.", {
      status: 403,
    });
  }

  const enrollmentCount = getEnrollmentCountForCourse(courseId);
  const earnings = getCourseEarnings(courseId);
  const completionRate = getCourseCompletionRate(courseId);
  const dropOff = getDropOffLessons(courseId);
  const quizPerformance = getQuizPerformance(courseId);

  return {
    course,
    enrollmentCount,
    earnings,
    completionRate,
    dropOff,
    quizPerformance,
  };
}

function formatChartRevenue(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export default function CourseAnalytics({ loaderData }: Route.ComponentProps) {
  const {
    course,
    enrollmentCount,
    earnings,
    completionRate,
    dropOff,
    quizPerformance,
  } = loaderData;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/instructor/${course.id}`} className="hover:text-foreground">
          {course.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      <div className="mb-8 flex items-center gap-4">
        <Link to={`/instructor/${course.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{course.title}</h1>
          <p className="mt-1 text-muted-foreground">Course analytics</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Enrollments
            </CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {enrollmentCount.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gross Revenue
            </CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(earnings.total)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completion Rate
            </CardTitle>
            <CheckCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Drop-off Point
            </CardTitle>
            <TrendingDown className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dropOff.find((l) => l.isDropOff)?.lessonTitle ?? "None"}
            </div>
            {dropOff.find((l) => l.isDropOff) && (
              <p className="text-xs text-muted-foreground">
                Biggest student drop
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Earnings Chart */}
      {earnings.monthly.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={earnings.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tick={{
                    fontSize: 12,
                    fill: "var(--muted-foreground)",
                  }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={formatChartRevenue}
                  tick={{
                    fontSize: 12,
                    fill: "var(--muted-foreground)",
                  }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip
                  formatter={(value) => [
                    formatPrice(value as number),
                    "Revenue",
                  ]}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Bar
                  dataKey="revenue"
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Drop-off Funnel */}
      {dropOff.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Lesson Completion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dropOff.map((lesson) => (
                <div key={lesson.lessonId} className="flex items-center gap-3">
                  <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">
                    {lesson.position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span
                        className={
                          lesson.isDropOff
                            ? "font-semibold text-destructive"
                            : ""
                        }
                      >
                        {lesson.lessonTitle}
                        {lesson.isDropOff && " (drop-off)"}
                      </span>
                      <span className="ml-2 shrink-0 text-muted-foreground">
                        {lesson.completedPercent}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          lesson.isDropOff ? "bg-destructive" : "bg-primary"
                        }`}
                        style={{ width: `${lesson.completedPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quiz Performance */}
      {quizPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quiz Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium">Quiz</th>
                    <th className="pb-3 pr-4 font-medium">Lesson</th>
                    <th className="pb-3 pr-4 text-right font-medium">
                      Students
                    </th>
                    <th className="pb-3 pr-4 text-right font-medium">
                      Pass Rate
                    </th>
                    <th className="pb-3 text-right font-medium">Avg Score</th>
                  </tr>
                </thead>
                <tbody>
                  {quizPerformance.map((q) => (
                    <tr key={q.quizId} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{q.quizTitle}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {q.lessonTitle}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {q.attemptedCount}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span
                          className={
                            q.attemptedCount >= 5 && q.passRate < 50
                              ? "font-semibold text-destructive"
                              : ""
                          }
                        >
                          {q.passRate}%
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {q.attemptedCount > 0
                          ? `${Math.round(q.avgScore * 100)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {enrollmentCount === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <h3 className="mb-1 text-lg font-semibold">No enrollments yet</h3>
            <p className="text-sm text-muted-foreground">
              Analytics will populate once students enroll in this course.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading analytics.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message =
        typeof error.data === "string"
          ? error.data
          : "You don't have permission to view this page.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/instructor">
            <Button variant="outline">My Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
