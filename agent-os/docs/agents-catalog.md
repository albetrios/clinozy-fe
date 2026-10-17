# Agents catalog (clinozy-fe)

The autonomous agents defined under [`agent-os/agents/`](../agents/) and shared
across Cursor and Claude Code via the `.cursor/agents/` and `.claude/agents/`
symlinks. Agents are read-only validators/investigators — for task instructions
(how to build something) see [`agent-os/skills/`](../skills/) and the
[skill registry](../skills/fe-skill-registry/SKILL.md).

## Catalog (11 agents)

| Agent                              | Purpose                                                                                                                                               | Tools (read-only)                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `fe-ci-investigator`               | Diagnoses a single failing PR CI check and returns a short root-cause summary with a fix plan.                                                        | Read, Grep, Glob, Bash                       |
| `fe-verifier`                      | Skeptical independent validator — runs health/tests, checks edge cases, reports pass vs incomplete after a task is marked done.                       | Read, Grep, Glob, Bash                       |
| `fe-docs-auditor`                  | Audits `docs/` for index completeness, naming, Mermaid, and cross-links after large doc changes.                                                      | Read, Grep, Glob, Bash                       |
| `fe-dependency-auditor`            | Runs `pnpm deps:audit` + lockfile/license/bundle-impact analysis and returns a prioritized fix plan.                                                  | Read, Grep, Glob, Bash                       |
| `fe-bundle-size-reviewer`          | Reviews build output for bundle-size regressions, broken code-splitting, and heavy first-paint imports against size budgets.                          | Read, Grep, Glob, Bash                       |
| `fe-perf-auditor`                  | Traces the local production preview with the chrome-devtools MCP — Core Web Vitals (LCP/CLS/TBT) insights, throttled re-run, budget verdict.          | Read, Grep, Glob, Bash + chrome-devtools MCP |
| `fe-a11y-auditor`                  | Whole-page accessibility audit — axe E2E lane when clinozy-be is up, static ARIA/focus/label sweep otherwise; complements vitest-axe component tests. | Read, Grep, Glob, Bash                       |
| `fe-i18n-auditor`                  | i18n audit — hardcoded user-facing strings bypassing react-i18next, locale key parity across `src/locales/*`, dead keys, namespace drift.             | Read, Grep, Glob, Bash                       |
| `fe-changelog-reviewer`            | Read-only changelog audit — CHANGELOG.md vs git log + merged PR titles; flags missing entries, wrong version bumps, stale `[Unreleased]`.             | Read, Bash                                   |
| `fe-tsdoc-coverage-reviewer`       | Runs `pnpm tsdoc:check` and lists public exports missing TSDoc summaries against the raise-only budget, ranked by blast radius.                       | Read, Grep, Glob, Bash                       |
| `fe-production-hardening-reviewer` | Client-security hardening sweep — CSP header/meta parity, token-in-memory discipline, single refresh path, cross-tab logout, env allowlist.           | Read, Grep, Glob, Bash                       |

## When to use which

- **CI is red** → `fe-ci-investigator` (one check at a time → root cause + fix plan).
- **"Is this actually done?"** → `fe-verifier` before claiming a feature complete.
- **Large doc change / doc review** → `fe-docs-auditor`.
- **Before a release/deploy** → `fe-dependency-auditor` + `fe-bundle-size-reviewer` + `fe-perf-auditor` + `fe-production-hardening-reviewer` (the `prod-readiness` pipeline).
- **"Why is first paint slow?" / Web-Vitals check** → `fe-perf-auditor` (production preview trace, never the dev server).
- **A11y sweep beyond component tests** → `fe-a11y-auditor` (whole-page landmarks/focus/contrast; findings → `web-design-guidelines`).
- **Before/after adding locales or extracting copy** → `fe-i18n-auditor` (findings → `fe-i18n-constants`).
- **Before cutting a release** → `fe-changelog-reviewer` (CHANGELOG.md vs git log / merged PRs — gap report).
- **TSDoc budget red or new public exports** → `fe-tsdoc-coverage-reviewer` (missing summaries vs the raise-only budget).
- **Before production / after touching auth, CSP, or env** → `fe-production-hardening-reviewer` (client-security sweep against `docs/reference/security-model.md`).

## Conventions

- Each agent is a Markdown file with frontmatter (`name`, `description`, `model`, `effort`,
  optional `background`, `omitClaudeMd`, `tools`, `readonly`, `disallowedTools`). Shape and
  discovery rules: [`agent-os/agents/README.md`](../agents/README.md).
- Models are set by job: `fe-verifier` and `fe-production-hardening-reviewer` (judgment calls) on
  Opus with high effort; the auditors and `fe-ci-investigator` on Sonnet, medium;
  `fe-changelog-reviewer` on Haiku, low. Report agents run in the background; the dependency,
  TSDoc and changelog reviewers skip CLAUDE.md (`omitClaudeMd`). `check.ts` validates every field.
- All are `readonly: true` — they investigate and report; they do not
  modify the working tree. `check.ts` enforces this: a `readonly` agent must
  declare a `tools` allowlist that excludes every write tool, and list every write tool in
  `disallowedTools`.
- Author once under `agent-os/agents/`; both Cursor and Claude pick them up via
  symlink.

## Review pipelines

Named sequences of these read-only agents live in
[`agent-os/agents/pipelines.json`](../agents/pipelines.json) — the source of
truth for what the [`/fe-pre-merge-review`](../commands/fe-pre-merge-review.md)
command runs. The `pre-merge-review` pipeline starts the reviewers its `when` says the diff
needs (`fe-verifier` always, `fe-docs-auditor` on docs changes) at once, in the background, and
aggregates one report in `REVIEW.md` → Findings format; each step's `handoff`
names the skill that fixes its findings (`verifier → fe-test-generation`,
`fe-docs-auditor → fe-documentation-maintenance`). The
[`/fe-prod-readiness`](../commands/fe-prod-readiness.md) command runs the
`prod-readiness` pipeline before a release/deploy — `fe-dependency-auditor` and
`fe-production-hardening-reviewer` at once (the hardening reviewer runs once per HEAD, reusing a
`/fe-pre-merge-review` report on the same HEAD), then `fe-bundle-size-reviewer` → `fe-perf-auditor`,
which each build the app. Every report is one line per finding in `REVIEW.md` → Findings format
(`fe-dependency-auditor → fe-dependency-management`,
`fe-bundle-size-reviewer → fe-bundle-performance`,
`fe-perf-auditor → fe-bundle-performance`,
`fe-production-hardening-reviewer → fe-code-quality-security`). `check.ts` gates the
manifest — every step resolves to an agent file and every handoff to a skill
directory.

## Adding an agent

1. Drop `fe-<agent-name>.md` into [`agent-os/agents/`](../agents/), with frontmatter
   `name: fe-<agent-name>` (every agent this repo owns starts with `fe-`).
2. Wire it into [`agent-os/rules/fe-skill-router.mdc`](../rules/fe-skill-router.mdc) if
   it belongs to a task pipeline.
3. Add a row to the catalog above and bump its `(N agents)` count.

## Related

- Skills: [`agent-os/skills/`](../skills/) · [skill registry](../skills/fe-skill-registry/SKILL.md)
- Platform wiring: [platform-access.md](platform-access.md)
- Commands: [`agent-os/docs/commands.md`](../docs/commands.md)
