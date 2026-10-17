---
description: Run the read-only pre-merge review pipeline and aggregate one report
argument-hint: '[release] — no argument reviews the branch; release reviews everything since the last release tag'
allowed-tools: Bash(git diff*), Bash(pnpm*)
---

Read `REVIEW.md` (repo root) first — it defines the severity ladder and the findings format every
reviewer in this pipeline uses. Then run the **`pre-merge-review`** pipeline over the diff:

- No argument: the branch — `git diff main...HEAD`, plus uncommitted changes.
- `release`: everything since the last release — `git fetch --tags --quiet origin`, then
  `git diff "$(git describe --tags --abbrev=0 --match 'v*' origin/main)"...HEAD`. No tag yet: say so
  and review the branch instead.

1. Read [`agent-os/agents/pipelines.json`](../agents/pipelines.json) → `pre-merge-review`. Its
   `steps` are the reviewers, its `when` says which ones the diff needs (the pipeline, not this
   prose, is the source of truth): **fe-verifier** always — `/fe-validate` plus the relevant tests
   (`pnpm test`; `pnpm test:security` when auth, CSP or token code changed), confirming the change
   works, not just that it compiles; **fe-docs-auditor** when docs or agent-os files changed — index
   completeness, naming, Mermaid and cross-links; **fe-production-hardening-reviewer** in diff mode
   when auth, tokens, CSP or tenancy changed. Its `lenses` are skills, not agents: on those same
   files, one general-purpose agent applies **fe-full-code-review** › Diff mode — the code pass.
2. **Start every needed reviewer at once, in the background** — one message with one agent call
   each, each told the diff range and to return findings in `REVIEW.md` → Findings format. A session
   capped at fewer parallel agents runs them in batches of that size. Do not read their transcripts
   while they run; each one's report arrives when it finishes.
3. **Aggregate one report** as `aggregate` says: every finding in the one format, sorted by severity
   (critical first), the same `file:line` and check from two reviewers merged into one line, at most
   two nits. Then the verifier's verdict and evidence, then each reviewer's `Satisfied` list in one
   line per check.

Each finding names the procedural skill that fixes it (`handoff`: agent finds, skill fixes —
`fe-verifier → fe-test-generation`, `fe-docs-auditor → fe-documentation-maintenance`). Skill lenses
that are not agents (`fe-code-smells-best-practices`, `web-design-guidelines`, `fe-lint-guard`) still
apply via their own file-pattern routing in `agent-os/docs/skill-triggers.md`. This is review-only:
do not edit files.

**Blocking, from 2026-10-31.** Until then the review only warns — `/fe-ship` reports the findings
and still pushes. When the user says a finding is a false positive, add a row to
`agent-os/evals/warn-only-false-positives.md` (date, reviewer, `file:line` · check, why it is wrong),
so the reviewers can be tuned before the switch. From 2026-10-31 a `critical` or `major` finding
stops `/fe-ship` before the push until it is fixed or the user overrides it.
