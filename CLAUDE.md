# Loan Calculator
Purpose: EMI loan calculator web app (React, TS).

## Commands
- Test: `npm test`
- Lint: `npm run lint && npm run typecheck`
- Build: `npm run build`

## Architecture
src/ — pure logic in *.ts modules with tests; UI in components (App.tsx)

## Rules
- Read only the files you need; do not scan the whole repo.
- Every behavior change needs a test. Run tests and lint before finishing.
- No new dependencies, permissions, or signing/secrets changes without asking.
- Never commit secrets, keystores, .env files.
- Keep PRs under ~300 changed lines; one issue per PR.
- Be concise: diffs plus a 3-line summary.
- If tests still fail after 3 attempts, stop and report the blocker.

## Definition of done
Lint clean, tests pass, CI green, short summary, PR opened as draft.
