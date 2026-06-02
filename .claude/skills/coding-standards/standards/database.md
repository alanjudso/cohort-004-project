# Database Standards

Stack: SQLite via better-sqlite3 + Drizzle. DB instance in `app/db/index.ts` (WAL mode, foreign keys enabled).

## IDs

Always `integer().primaryKey({ autoIncrement: true })`. Never UUIDs.

## Timestamps

Store as ISO strings in `text` columns. Use `$defaultFn(() => new Date().toISOString())` for defaults. Never unix timestamps or integers.

## Booleans

Use Drizzle's `mode: "boolean"` on integer columns:

```ts
integer("ppp_enabled", { mode: "boolean" })
```

## Soft deletes

Use a nullable `text("deleted_at")` column. Never actually delete rows. See `lessonComments` in the schema for reference.

## Prices

Store in cents as integers. Display with `formatPrice()` from `~/lib/utils` — it handles the "Free" case for 0/null.

## Connections

Don't create new `Database` connections in service code. Use the shared db instance from `app/db/index.ts`.
