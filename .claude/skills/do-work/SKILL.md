---
name: do-work
description: Full implementation cycle: plan the work, load relevant coding standards, implement, run feedback loops (pnpm type check + pnpm run test) until clean, then commit. Use when asked to implement a feature, fix a bug, or complete any coding task end-to-end. Triggers: "do the work", "implement this", "build this", "let's do it", or any hands-on coding task that should end with a commit.
---

# Do Work

## Workflow

### 1. Understand the task

- Read reference plan or PRD.
- Understand the relevant files, patterns and conventions.
- Call out any ambiguities before touching code

### 2. Optional - Plan the implementation

- if task hasn't been planned, create plan.

### 3. Implement — red/green loop per slice

Use red/green/refactor loop, one test at a time in the tracer-bullet style:

1. **Red** — write a single failing test for the smallest vertical slice of behaviour. Run it and confirm it fails.
2. **Green** — write the minimum code to make it pass. Run the test; confirm green.
3. Repeat from Step 1 for the next slice.
4. **Refactor** — clean up while keeping tests green.

Rules:

- No speculative abstractions, no unrelated cleanup
- One slice at a time — don't write multiple tests before any code

### 4. Feedback loop — repeat until both pass

```bash
pnpm type check
```

Fix all type errors before proceeding.

```bash
pnpm run test
```

Fix all failing tests repeat until 0 failing tests before proceeding.

### 5. Commit

Commit the changes

## Rules

- Never commit with type errors or failing tests
- Never use `git add -A` — stage specific files only
- Never skip hooks (`--no-verify`)
- Ask before force-pushing or amending published commits
