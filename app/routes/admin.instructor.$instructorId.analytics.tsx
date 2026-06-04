import { Link } from "react-router";
import { data, isRouteErrorResponse } from "react-router";
import { AlertTriangle } from "lucide-react";
import type { Route } from "./+types/admin.instructor.$instructorId.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { UserRole } from "~/db/schema";
import { getAnalyticsSummary, getRevenueTimeSeries, getPerCourseBreakdown, parsePeriod } from "~/services/analyticsService";
import { AnalyticsDashboard } from "~/components/analytics-dashboard";
import { Button } from "~/components/ui/button";

export function meta() {
  return [
    { title: "Instructor Analytics — Cadence" },
    { name: "description", content: "Instructor course revenue analytics" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to view analytics.", {
      status: 401,
    });
  }

  const currentUser = getUserById(currentUserId);

  if (!currentUser || currentUser.role !== UserRole.Admin) {
    throw data("Only admins can access this page.", { status: 403 });
  }

  const instructorId = Number(params.instructorId);
  const instructor = getUserById(instructorId);

  if (!instructor) {
    throw data("Instructor not found.", { status: 404 });
  }

  const url = new URL(request.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const summary = getAnalyticsSummary(instructorId, period);
  const timeSeries = getRevenueTimeSeries(instructorId, period);
  const courseBreakdown = getPerCourseBreakdown(instructorId, period);

  return { summary, period, timeSeries, courseBreakdown };
}

export default function AdminInstructorAnalytics({ loaderData }: Route.ComponentProps) {
  const { summary, period, timeSeries, courseBreakdown } = loaderData;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link to="/admin/users" className="hover:text-foreground">
          Manage Users
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Instructor Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Revenue and enrollment overview for this instructor's courses
        </p>
      </div>

      <AnalyticsDashboard summary={summary} period={period} timeSeries={timeSeries} courseBreakdown={courseBreakdown} />
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
          : "You don't have permission to access this page.";
    } else if (error.status === 404) {
      title = "Instructor not found";
      message =
        typeof error.data === "string" ? error.data : "This instructor does not exist.";
    } else {
      title = `Error ${error.status}`;
      message =
        typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/admin/users">
            <Button variant="outline">Manage Users</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
