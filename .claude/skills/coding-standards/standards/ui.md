# UI Standards

## Tailwind class merging

Use `cn()` from `~/lib/utils` to combine Tailwind classes. It's clsx + tailwind-merge.

```ts
import { cn } from "~/lib/utils";

<div className={cn("base-class", isActive && "active-class", className)} />
```

## Component locations

- Shadcn components: `app/components/ui/`
- Custom components: `app/components/`
- Don't nest component folders deeper than one level
