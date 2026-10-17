---
description: Run the read-only production-readiness pipeline and aggregate one report
argument-hint: (no arguments — sweeps the current branch before release/deploy)
allowed-tools: Bash(git diff*), Bash(pnpm*)
---

Read `REVIEW.md` (repo root) first — the severity ladder and the findings format. Then run the
**`prod-readiness`** pipeline defined in [`agent-os/agents/pipelines.json`](../agents/pipelines.json)
as read-only agents before a release/deploy, and aggregate one report. The pipeline (not this prose)
is the source of truth for the steps, their order and the handoffs:

1. **At once, in the background** (batches of the session's agent cap when it has one):
   - **fe-dependency-auditor** — `pnpm deps:audit` (+ `deps:audit:prod`), lockfile sync, license and
     bundle-impact of any new dependency.
   - **fe-production-hardening-reviewer** — client-security sweep against
     `docs/reference/security-model.md`: CSP header/meta parity, token-in-memory discipline, single
     refresh path, cross-tab logout, env allowlist. **Once per HEAD:** when `/fe-pre-merge-review`
     already ran it on this HEAD, reuse that report instead of running it again.
2. **One after the other** (each builds the app, so they cannot share `dist/`):
   - **fe-bundle-size-reviewer** — `pnpm build` + `pnpm size` against the size-limit budgets;
     code-splitting regressions and heavy first-paint static imports.
   - **fe-perf-auditor** — Chrome DevTools trace of the production preview (`pnpm build` +
     `pnpm preview`): LCP/CLS/TBT insights plus a throttled re-run; skips gracefully to static checks
     when the chrome-devtools MCP is unavailable.

Each finding is one line in `REVIEW.md` → Findings format and names the procedural skill that fixes
it, per the pipeline's `handoff` map: `fe-dependency-auditor → fe-dependency-management`,
`fe-bundle-size-reviewer → fe-bundle-performance`, `fe-perf-auditor → fe-bundle-performance`,
`fe-production-hardening-reviewer → fe-code-quality-security`. Produce one report: satisfied items,
then the findings by severity — `critical` and `major` block the release, `minor` and `nit` are the
optional improvements. This is review-only: do not edit files.
