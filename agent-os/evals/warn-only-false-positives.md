# Warn-only false positives

The checks below warn before they block, so their rules are tuned on real changes first. Add a row
when the user says a finding is wrong; never edit a row afterwards. The same log as clinozy-be's.

## Review findings

Findings from the `/fe-pre-merge-review` reviewers (`agent-os/agents/`, the `fe-full-code-review`
lens), before the review starts blocking `/fe-ship` on 2026-10-31 — so the reviewers and
`REVIEW.md` can be tuned.

| Date | Reviewer | Finding (`file:line` · check) | Why it is wrong |
| ---- | -------- | ----------------------------- | --------------- |

## Early checks

Findings from the early checks — the dependency audit and the client env allowlist at commit
(before-commit guard steps 11 and 12) and Semgrep at push (`pnpm security:semgrep:push`) — before
they block on 2026-10-31 (`tooling/ci/early-checks.mjs`).

| Date | Check | Finding | Why it is wrong |
| ---- | ----- | ------- | --------------- |
