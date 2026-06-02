# TypeScript Standards

## Object parameters for same-type args

When a function has more than one parameter of the same type, use an object parameter.

```ts
// BAD
const addUserToPost = (userId: string, postId: string) => {};

// GOOD
const addUserToPost = (opts: { userId: string; postId: string }) => {};
```

## No `any`

Don't use `any`. If you need a type you're unsure about, check the Drizzle schema or use `typeof` inference.

## Import aliases

Use `~/*` for anything inside `/app`. Never use relative paths like `../../lib/utils`.

```ts
// BAD
import { cn } from "../../lib/utils";

// GOOD
import { cn } from "~/lib/utils";
```
