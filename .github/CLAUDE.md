# CI, branches and merging — clinozy-fe

Claude Code loads this file when it works in `.github/`. It holds sections moved out of the root [`CLAUDE.md`](../CLAUDE.md), which keeps a pointer to each; the root rules apply here too.

## Quality gates

**Quality gates (mirrors clinozy-be):** Biome is a second lint lane (`biome.json`; formatter
disabled — Prettier + `prettier-plugin-tailwindcss` own formatting). SonarQube runs locally in
Docker and is enforced by `.husky/pre-push` on deployed-surface changes (`pnpm sonar:scan`;
no per-gate bypass — a red gate must be fixed, not skipped) — see docs/reference/quality/sonarqube-local.md.
Coverage thresholds in `vitest.config.ts` are a **ratchet**: pinned just under measured
coverage, raised as coverage rises, never lowered; the same raise-never philosophy applies to
the **TSDoc budget** (`pnpm tsdoc:check`, `tooling/tsdoc-coverage/budget.json`) and to **patch
coverage** (changed lines ≥ 90% — PR CI runs `tooling/ci/check-patch-coverage.mjs`; local
mirror: `pnpm coverage:patch`). Vitest is split into
`unit` (colocated src suites), `security` (tests/security — token storage, redirect
safety, header tripwires), and `ci-policy` (tests/ci — workflow wiring, release-please
manifests, Dependabot flow invariants) projects. Markdown is linted
(`pnpm docs:lint`; emphasis style follows Prettier) in its own path-filtered workflow
(`pr-docs-lane.yml`, outside the quality gate). CI (`.github/workflows/pr-ci.yml`) runs
path-filtered parallel lanes — biome/eslint/prettier/tsc/vitest(+patch coverage)/security-tests/
knip/structure+tsdoc/agent-os-gate/build+size+SBOM/gitleaks/semgrep/Trivy-IaC/deps-audit/
dependency-review/actionlint/zizmor (workflow injection + action pins)/SonarQube —
behind the aggregate `Quality gate` required check (`Checks` is the second required
context; branch protection as code:
`.github/rulesets/`, `pnpm github:sync`; personal↔team review posture via
`pnpm github:tool:governance-mode` — see docs/reference/branch-governance.md). Playwright E2E is local-only (needs
clinozy-be on `:3000` — CI never boots the backend). CodeQL, Stryker mutation tests, Lighthouse
budgets, cache cleanup, release-flow guards (environment-drift canary),
the sync-drift canary (weekly docs↔code drift → tracked issue),
and Dependabot CI triage + approval-gated auto-merge (low-risk `npm-non-major` group only)
run as scheduled/event workflows (enforced registry: docs/reference/scheduled-jobs.md).

**Merge policy — never merge on red (enforced, not just convention):** the `main` ruleset carries
**no `bypass_actors`**, so a PR with any failing or pending required check (`Quality gate`, `Checks`)
**cannot be merged by anyone — the repo owner included**. Never re-add `bypass_actors` to
`.github/rulesets/main.json`, and never merge with `--admin` or the merge API to skip a red gate: a
flaky-red required check is **re-run (or its branch updated) to green**, never bypassed. `strict up-to-date`
is off so a green PR merges cleanly with `gh pr merge --squash` (no bypass needed); `required_signatures`
is intentionally absent (branch commits are unsigned — the squash-merge commit GitHub creates on `main`
is signed regardless). The ruleset content is pinned by `tests/ci/rulesets.policy.test.ts`.

**Lockfile discipline:** a `package.json` dependency or `pnpm-workspace.yaml` `overrides` change
and its `pnpm-lock.yaml` regeneration are **one atomic commit** — run `pnpm install` and stage both.
(pnpm 11+ reads settings only from `pnpm-workspace.yaml`; a `pnpm` field in `package.json` is ignored.)
A desynced lockfile fails every frozen-install CI job (`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`) and
also reds any open release-please PR, so it must never reach main; the before-commit guard blocks
it locally via `pnpm run validate:lockfile` (see `agent-os/skills/fe-platform-hygiene/SKILL.md`).

## Git branch naming

Working branches are `<type>/<short-description>`; `main` is the only long-lived branch. Enforced by [`.husky/pre-push`](../.husky/pre-push) (rule: `agent-os/rules/fe-git-branch-naming.mdc`, owner: **fe-code-quality-security**).

**AI web sessions start on a throwaway name.** Claude Code web assigns `claude/<platform-slug>` (e.g. `claude/session-request-wx3euu`) before the container boots. The slug is generated platform-side and is **not configurable from this repo** — no file here changes it. Rename it to a meaningful name rather than shipping it.

**Name the branch before the first push.** The cloud git proxy accepts a push to _any_ branch name but **rejects every form of delete** (`git push --delete`, `git push :ref`, and `DELETE /git/refs/...` → 403, even for a ref that does not exist). A `claude/*` branch that has already been pushed therefore cannot be cleaned up from inside the session. Renaming first means the throwaway name never reaches the remote:

```sh
git branch -m docs/branch-naming-guidance      # rename in place, BEFORE any push
git push -u origin docs/branch-naming-guidance
```

Already pushed as `claude/*`? Leave it — it disappears when the PR squash-merges. Never open a second PR just to fix a branch name.

**Deriving the name** — `<type>` is the change's conventional-commit type (`feat`, `feature`, `fix`, `hotfix`, `chore`, `ci`, `docs`, `refactor`, `test`, `perf`, `build`, `style`, `revert`, matching the accepted-prefix regex in `.husky/pre-push`); `<short-description>` is kebab-case, 2–5 words, ≤ 40 chars, naming the change itself (never a ticket id or a date). Keep it aligned with the commit subject and PR title.

| Change                                | Branch                                |
| ------------------------------------- | ------------------------------------- |
| Fix British spelling in a doc         | `docs/american-spelling-organization` |
| Add the billing invoices route island | `feat/billing-invoice-route`          |
| Org guard drops the slug on refresh   | `fix/org-slug-guard-refresh`          |
| Bump Vite to 8.1                      | `chore/bump-vite-8-1`                 |
