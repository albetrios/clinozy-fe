# False positives

The pre-merge review and the early checks block on a finding. When the user says a finding is
wrong, add a row here and fix the rule; never edit a row afterwards. The same log as clinozy-be's.

## Review findings

Findings from the `/fe-pre-merge-review` reviewers (`agent-os/agents/`, the `fe-full-code-review`
lens) — so the reviewers and `REVIEW.md` get tuned.

| Date | Reviewer | Finding (`file:line` · check) | Why it is wrong |
| ---- | -------- | ----------------------------- | --------------- |

## Early checks

Findings from the early checks — the dependency audit and the client env allowlist at commit
(before-commit guard steps 11 and 12), Semgrep at push (`pnpm security:semgrep:push`) and the live
CSP and HSTS check after each Netlify deploy (`pnpm deploy:probe-live`) — `tooling/ci/early-checks.mjs`.

| Date       | Check           | Finding                                                                                         | Why it is wrong                                                                                                                                                                                                                                                                                                                                |
| ---------- | --------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-31 | Semgrep at push | `src/app/observability/sentry.ts` `sentryTracePropagationTargets` · `detect-non-literal-regexp` | The pattern is `^`, the API origin with every metacharacter escaped, then `/` — no quantifier, group or alternation, so it runs in linear time on any URL; the origin is the deploy's own `API_BASE_URL`, reduced to an http(s) origin. Sentry takes only strings (substring match, too loose) or RegExps. Suppressed inline with `nosemgrep`. |
