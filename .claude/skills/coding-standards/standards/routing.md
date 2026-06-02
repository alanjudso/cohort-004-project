# Routing Standards

Framework: React Router v7, file-based routing.

## Route files

Routes go in `app/routes/`. Each file can export: `loader`, `action`, `default` (component), `meta`, `ErrorBoundary`.

Don't put business logic directly in routes — call into services instead.

## Auth

```ts
const userId = await getCurrentUserId(request); // from ~/lib/session
if (!userId) return redirect("/login");
```

Returns `number | null`.

## Form validation

Use `parseFormData`, `parseParams`, or `parseJsonBody` from `~/lib/validation`:

```ts
const { success, data, errors } = await parseFormData(formData, zodSchema);
```

## Multiple form actions on one route

Use a Zod discriminated union on an `intent` field:

```ts
const schema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("mark-complete") }),
  z.object({
    intent: z.literal("delete-comment"),
    commentId: z.coerce.number(),
  }),
]);
```
