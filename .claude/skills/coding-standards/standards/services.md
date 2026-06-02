# Service Standards

## Test requirement

Every service file (`*Service.ts`) must have a companion `*Service.test.ts` file.

## Result pattern

When returning tagged/discriminated results from a service, use:

```ts
{ ok: true; data: ... } | { ok: false; error: string }
```

This is for service return values — not for validation (which uses `parseFormData`). See `couponService` for a reference implementation.
