---
name: auto-qa
description: Automated QA runner that exercises changed features without user interaction. Reads the current git diff to generate test cases covering golden path, edge cases, regression, and basic accessibility, then executes them using the best available automation tool. Reports bugs found as GitHub Issues. Use when user says "auto QA", "automated QA", "QA this automatically", or after completing a feature and wants it validated without manual steps.
---

# Auto QA

## Workflow

### 1. Detect automation tool
Try in order — use the first one that works:

1. **Computer use** — only viable in a local desktop session. Skip if `$DISPLAY` is unset, `$CI` is set, or no MCP tool whose name contains `computer` or `desktop` is available. Otherwise use it.
2. **agent-browser** — invoke the `agent-browser` skill. Works locally and in headless/remote environments.
3. **Playwright** — check `npx playwright --version 2>/dev/null`. If it exits 0, run tests via `npx playwright` or write a short inline script.
4. **curl** — always available; use for API-only routes and as a last resort for HTML smoke checks.

Log which tool you selected before proceeding.

### 2. Start dev server
- Check if server is already running: `lsof -iTCP -sTCP:LISTEN -P | grep -E ':(3000|5173|8080|4173)'`
- If not running, identify the start command from `package.json` scripts and start it.
- Wait for the port to be ready before running tests.

### 3. Generate test cases from diff
Run `git diff main...HEAD` (or `git diff HEAD` if on main).

For each meaningful change, generate test cases covering:
- **Golden path** — the primary happy path works end-to-end
- **Edge cases** — empty states, error states, boundary values visible in the diff
- **Regression** — adjacent features not touched by the diff still function
- **Accessibility** — visible labels present, keyboard-navigable, no obvious contrast failures

### 4. Execute tests automatically
For each test case:
1. Use the selected tool to navigate, interact, and assert
2. Capture a screenshot or response body as evidence
3. Mark the test **PASS** or **FAIL** with a one-line reason

Do **not** pause for user input during test execution. Run all cases, then report.

### 5. Report bugs as GitHub Issues
For every FAIL, open a GitHub Issue:
```
gh issue create \
  --title "QA: <short description>" \
  --body "## Steps\n<steps>\n\n## Expected\n<expected>\n\n## Actual\n<actual>\n\n## Evidence\n<screenshot path or curl output>"
```

### 6. Summary
After all tests complete, print:
- Tool used
- N tests run, N passed, N failed
- List of opened issue URLs (or "no bugs found")

## Rules
- Never block waiting for the user mid-run. Collect all results first, then report.
- If the dev server fails to start, stop and tell the user — don't try to test a dead server.
- If computer use or agent-browser are available, prefer them over curl for UI routes; curl alone cannot verify rendered output.
- Keep generated Playwright scripts in `tmp/auto-qa-*.js` so they're inspectable but not committed.
