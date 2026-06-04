import { BarChart2 } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface AnalyticsSummary {
  totalRevenue: number;
  totalEnrollments: number;
  averageRating: number | null;
  ratingCount: number;
}

interface AnalyticsDashboardProps {
  summary: AnalyticsSummary;
  period: string;
}

const PERIODS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "12m", label: "12 months" },
  { value: "all", label: "All time" },
] as const;

function formatRevenue(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function AnalyticsDashboard({ summary, period }: AnalyticsDashboardProps) {
  const navigate = useNavigate();
  const hasData = summary.totalRevenue > 0;

  const periodSelector = (
    <div className="flex gap-2">
      {PERIODS.map(({ value, label }) => (
        <Button
          key={value}
          variant={period === value ? "default" : "outline"}
          size="sm"
          onClick={() => navigate(`?period=${value}`)}
        >
          {label}
        </Button>
      ))}
    </div>
  );

  if (!hasData) {
    return (
      <div className="space-y-6">
        {periodSelector}
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BarChart2 className="mb-4 size-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">No revenue data yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Publish a course to start tracking analytics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {periodSelector}
      <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatRevenue(summary.totalRevenue)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Enrollments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalEnrollments}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Average Rating
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.averageRating != null
              ? `${summary.averageRating.toFixed(1)} / 5`
              : "—"}
          </div>
          {summary.ratingCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {summary.ratingCount}{" "}
              {summary.ratingCount === 1 ? "rating" : "ratings"}
            </p>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
