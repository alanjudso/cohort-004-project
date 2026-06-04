# Plan: Instructor Revenue Analytics Dashboard

> Source PRD: `prd/instructor-analytics-dashboard.md`

## Architectural Decisions

Durable decisions that apply across all phases:

- **Routes**: `/instructor/analytics` (instructor-only), `/admin/instructor/:instructorId/analytics` (admin-only). Separate paths keep URL namespaces clean and instructor routes exclusively for instructors.
- **Schema**: No changes. All required data exists: `purchases` (revenue, `pricePaid` in cents), `enrollments` (`enrolledAt`), `courseRatings` (`rating`, `createdAt`), `courses` (`instructorId`, `price`).
- **analyticsService**: Single service module. Takes `instructorId` and `period`, returns all dashboard data in one call: summary totals, time series, per-course breakdown. Return type is extendable without breaking the interface.
- **Time period filter**: `?period=7d|30d|12m|all` URL search param. Defaults to `30d`. Stored in the URL so views are bookmarkable. The loader reads it; the component navigates to update it.
- **Instructor isolation**: The instructor route reads the user ID from the session and passes it to the service. It never accepts an instructor ID from the client. The admin route reads the instructor ID from URL params after verifying admin role.
- **Auth pattern**: `getCurrentUserId(request)` + role check against `UserRole.Instructor` or `UserRole.Admin`. Unauthorized access throws a `data()` response with `status: 403`.
- **Price formatting**: `formatPrice()` utility converts cents to dollars for display.
- **Chart library**: `recharts` (new dependency, added in Phase 3).

---

## Phase 1: Summary Cards End-to-End

**User stories**: 1, 2, 3, 10, 12, 16, 17, 19, 20

### What to build

A thin vertical slice from the database to the browser. The `analyticsService` gains a summary query that aggregates total revenue (sum of `pricePaid`), total enrollments (count of `enrolledAt`), and average rating (avg of `rating`) for a given instructor and time period — defaulting to all time when no period boundary is needed. The `/instructor/analytics` route authenticates the user as an instructor, calls the service with the instructor's own user ID and the `?period=` param (defaulting to `30d`), and passes the data to a new `AnalyticsDashboard` component. The component renders three summary cards (Total Revenue, Total Enrollments, Average Rating) and a friendly empty state when there is no data. Students and unauthenticated users are blocked at the loader.

### Acceptance criteria

- [ ] Visiting `/instructor/analytics` as an instructor renders summary cards showing real data from the database
- [ ] Default period is `30d` when no `?period=` param is present
- [ ] Revenue is displayed formatted in dollars (e.g. `$120.00`), not cents
- [ ] When the instructor has no courses or no data, a single friendly empty state message is shown instead of zero-filled cards
- [ ] A student visiting `/instructor/analytics` receives a 403 response
- [ ] An unauthenticated user visiting `/instructor/analytics` is redirected to login
- [ ] `analyticsService` has a test file covering: correct revenue sum, correct enrollment count, correct average rating, and instructor isolation (data from another instructor's courses is excluded)

---

## Phase 2: Period Selector

**User stories**: 5, 6, 9, 19

### What to build

Add a period selector UI to the dashboard that lets the instructor switch between 7d, 30d, 12mo, and All time. Selecting a period navigates to the same route with the updated `?period=` param, causing the loader to re-run with the new boundary. The summary cards from Phase 1 update to reflect the selected period. The active period is visually highlighted. The `analyticsService` summary query is updated to correctly filter by each period boundary using `createdAt` timestamps on `purchases`, `enrollments`, and `courseRatings`.

### Acceptance criteria

- [ ] Period selector tabs (7d / 30d / 12mo / All) are rendered on the dashboard
- [ ] Clicking a tab navigates to `?period=<value>` and all summary card data updates
- [ ] The active period tab is visually distinguished
- [ ] The selected period persists in the URL (bookmarkable, shareable)
- [ ] `analyticsService` tests cover: period boundary filtering correctly includes/excludes data at the edges for each period value

---

## Phase 3: Dashboard Content (Chart + Table)

**User stories**: 4, 7, 8, 9, 18, 21, 22

### What to build

Extend the `analyticsService` with two new queries: a revenue time series (daily for 7d/30d, monthly for 12mo/All time, with `$0` fill for empty periods) and a per-course breakdown (title, list price, revenue, sales count, enrollment count, average rating, rating count — all scoped to the selected period). Add `recharts` as a project dependency. Render both sections on the dashboard: a `LineChart` below the summary cards, and a sortable per-course table below that. Sorting is client-side; every column is sortable, default is revenue descending.

### Acceptance criteria

- [ ] A line chart renders showing revenue over time for the selected period
- [ ] Chart granularity is daily for 7d and 30d, monthly for 12mo and All time
- [ ] Periods with zero revenue appear as `$0` data points (no gaps in the line)
- [ ] Chart updates when the period selector is changed
- [ ] Per-course table renders with columns: title, list price, revenue, sales count, enrollment count, average rating, rating count
- [ ] All table values are scoped to the selected period
- [ ] Clicking any column header sorts the table by that column; clicking again reverses sort direction
- [ ] Default sort is revenue descending
- [ ] Revenue and list price are displayed formatted in dollars
- [ ] `analyticsService` tests cover: daily/monthly bucketing, zero-revenue gap-filling, "All time" earliest purchase, correct per-course attribution, correct period scoping

---

## Phase 4: Admin Access and Nav Wiring

**User stories**: 11, 13, 14, 15

### What to build

Three small additions that make the dashboard discoverable:

1. A new `/admin/instructor/:instructorId/analytics` route that authenticates the user as an admin, reads the instructor ID from URL params and the period from search params, calls the `analyticsService`, and renders the shared `AnalyticsDashboard` component — identical output to the instructor's own view.
2. A "View Analytics" link added to each instructor row on the admin users page, pointing to `/admin/instructor/:id/analytics`.
3. An "Analytics" entry added to the instructor sidebar nav, pointing to `/instructor/analytics`, visible only to the instructor role.

### Acceptance criteria

- [ ] An admin visiting `/admin/instructor/:instructorId/analytics` sees the same dashboard layout and data as the instructor would
- [ ] A non-admin visiting the admin analytics route receives a 403 response
- [ ] The admin users page shows a "View Analytics" link next to each user with the instructor role
- [ ] The instructor sidebar nav includes an "Analytics" link that navigates to `/instructor/analytics`
- [ ] The "Analytics" nav entry is not visible to students or admins in the sidebar
