import { useState } from "react";
import { BarChart2 } from "lucide-react";
import { useNavigate } from "react-router";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { RevenueDataPoint, CourseBreakdownRow } from "~/services/analyticsService";

interface AnalyticsSummary {
  totalRevenue: number;
  totalEnrollments: number;
  averageRating: number | null;
  ratingCount: number;
}

interface AnalyticsDashboardProps {
  summary: AnalyticsSummary;
  period: string;
  timeSeries: RevenueDataPoint[];
  courseBreakdown: CourseBreakdownRow[];
}

const PERIODS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "12m", label: "12 months" },
  { value: "all", label: "All time" },
] as const;

type SortKey = keyof Pick<
  CourseBreakdownRow,
  "title" | "listPrice" | "revenue" | "salesCount" | "enrollmentCount" | "averageRating" | "ratingCount"
>;

function formatRevenue(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function AnalyticsDashboard({ summary, period, timeSeries, courseBreakdown }: AnalyticsDashboardProps) {
  const navigate = useNavigate();
  const hasData = summary.totalRevenue > 0;
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedBreakdown = [...courseBreakdown].sort((a, b) => {
    const aVal = a[sortKey] ?? -Infinity;
    const bVal = b[sortKey] ?? -Infinity;
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    const aNum = aVal as number;
    const bNum = bVal as number;
    return sortDir === "asc" ? aNum - bNum : bNum - aNum;
  });

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

  const columns: { key: SortKey; label: string }[] = [
    { key: "title", label: "Title" },
    { key: "listPrice", label: "List Price" },
    { key: "revenue", label: "Revenue" },
    { key: "salesCount", label: "Sales" },
    { key: "enrollmentCount", label: "Enrollments" },
    { key: "averageRating", label: "Avg Rating" },
    { key: "ratingCount", label: "Ratings" },
  ];

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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Revenue over time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={timeSeries} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => formatRevenue(v)} tick={{ fontSize: 11 }} width={72} />
              <Tooltip formatter={(v) => [formatRevenue(Number(v)), "Revenue"]} />
              <Line type="monotone" dataKey="revenue" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Per-course breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {columns.map(({ key, label }) => (
                    <th
                      key={key}
                      className="cursor-pointer select-none px-4 py-3 text-left font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => handleSort(key)}
                    >
                      {label}
                      {sortKey === key && (
                        <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedBreakdown.map((row) => (
                  <tr key={row.courseId} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{row.title}</td>
                    <td className="px-4 py-3">{formatRevenue(row.listPrice)}</td>
                    <td className="px-4 py-3">{formatRevenue(row.revenue)}</td>
                    <td className="px-4 py-3">{row.salesCount}</td>
                    <td className="px-4 py-3">{row.enrollmentCount}</td>
                    <td className="px-4 py-3">
                      {row.averageRating != null ? row.averageRating.toFixed(1) : "—"}
                    </td>
                    <td className="px-4 py-3">{row.ratingCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
