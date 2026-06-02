---
name: qa-session
description: Runs a structured one-question-at-a-time manual QA session with the user. Claude reads the current git diff to generate test cases, starts the dev server if needed, then asks the user one QA question at a time — waiting for feedback before proceeding. Bugs found are logged to tmp/qa-bugs.md instead of fixed immediately (unless the bug blocks further QA). Use when user wants to manually QA a feature, verify a branch before merging, or run a structured test session.
---

# QA Session

## Workflow

### 1. Setup
- Run `git diff main...HEAD` (or `git diff HEAD` if on main) to understand what changed
- Load the [[coding-standards]] skill to understand the project
- Identify the dev server start command (check `package.json` scripts — look for `dev`, `start`, or similar)
- Check if a dev server is already running: `lsof -iTCP -sTCP:LISTEN -P | grep -E ':(3000|5173|8080|4173)'` (or the port from the dev script). If a process is listening, skip starting a new one — just tell the user the URL. If not, start the dev server.
- Create `tmp/qa-bugs.md` with a header and empty bug list

### 2. Generate test cases
- From the diff, extract a list of test cases covering:
  - Happy path for each changed feature
  - Edge cases visible in the code (empty states, error states, boundary values)
  - Regression risk — areas adjacent to the change
- Order: happy paths first, edge cases second, regressions last
- After exhausting the diff, ask: "Want to QA any other areas of the app?"

### 3. Ask one question at a time
For each test case:
1. Tell the user **what to do** (specific navigation steps + action)
2. Tell the user **what to expect** (exact expected result)
3. Wait for their response — do NOT proceed until they reply
4. If they report a bug: log it (see below), then continue to the next question
5. If the bug **blocks further QA** (e.g., app crashes, page won't load): fix it immediately, then continue

**Question format:**
```
**QA [N/total]:** <feature area>

Steps: <numbered steps>
Expected: <what should happen>
```

### 4. Log bugs
Append to `tmp/qa-bugs.md`:
```md
## Bug N — <short title>
**QA question:** <the question that surfaced it>
**Steps to reproduce:** <what the user did>
**Expected:** <what should have happened>
**Actual:** <what happened>
**Severity:** blocking | high | medium | low
```

### 5. Wrap up
When all questions are done (or user says stop):
- Print a summary: N questions asked, N bugs found
- List bugs from `tmp/qa-bugs.md` with their severities
- Ask: "Want to file these as GitHub issues, or handle them separately?"

## Rules
- **One question per turn.** Never ask two things at once.
- **Wait for feedback.** Do not move on until the user responds.
- **Log, don't fix** — unless the bug blocks QA.
- **Be specific.** Vague questions ("does the feature work?") produce vague answers. Name exact UI elements, exact expected text, exact URLs.
- If the user's answer is ambiguous, ask a follow-up clarifying question before logging or moving on.
