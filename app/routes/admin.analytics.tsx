import { Link } from "react-router";
import { data, isRouteErrorResponse } from "react-router";
import {
  AlertTriangle,
  DollarSign,
  Users,
  Trophy,
  PackageOpen,
} from "lucide-react";
import type { Route } from "./+types/admin.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  getAdminAnalyticsSummary,
  parsePeriod,
} from "~/services/analyticsService";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn, formatPrice } from "~/lib/utils";
import { Button } from "~/components/ui/button";

const PERIODS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "12m", label: "12 months" },
  { value: "all", label: "All time" },
] as const;

export function meta() {
  return [
    { title: "Platform Analytics — Cadence" },
    {
      name: "description",
      content: "Platform-wide revenue and enrollment analytics",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const user = getUserById(currentUserId);

  if (!user || user.role !== UserRole.Admin) {
    throw data("Only admins can access this page.", { status: 403 });
  }

  const url = new URL(request.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const summary = getAdminAnalyticsSummary(period);

  return { summary, period };
}

export default function AdminAnalytics({ loaderData }: Route.ComponentProps) {
  const { summary, period } = loaderData;

  const hasData = summary.totalRevenue > 0 || summary.totalEnrollments > 0;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Platform Analytics</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Platform Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Revenue and enrollment overview across all courses
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              to={`?period=${p.value}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                period === p.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>

        {!hasData && (
          <Card>
            <CardContent className="py-12 text-center">
              <PackageOpen className="mx-auto mb-3 size-10 text-muted-foreground/50" />
              <h3 className="mb-1 text-lg font-semibold">
                No analytics data yet
              </h3>
              <p className="text-sm text-muted-foreground">
                Revenue and enrollment data will appear here once courses have
                purchases or enrollments.
              </p>
            </CardContent>
          </Card>
        )}

        {hasData && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </CardTitle>
                <DollarSign className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPrice(summary.totalRevenue)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Enrollments
                </CardTitle>
                <Users className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.totalEnrollments.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Top Earning Course
                </CardTitle>
                <Trophy className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {summary.topCourse ? (
                  <>
                    <div className="truncate text-2xl font-bold">
                      {formatPrice(summary.topCourse.revenue)}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {summary.topCourse.title}
                    </p>
                  </>
                ) : (
                  <div className="text-2xl font-bold">N/A</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
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
          : "Only admins can access this page.";
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
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
