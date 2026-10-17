---
name: fe-before-commit-guard
description: The pre-commit gate on every git commit (env docs, public assets, lint-staged, types, lockfile, gitleaks). Use when asked what runs on commit, or when a commit fails.
---

# Before-Commit Guard — Path-to-Production Gate

This skill runs **automatically when the user runs `git commit`** via the Husky pre-commit hook. It enforces the same quality gates used for path-to-production, at commit time.

## When to Invoke (Agent)

- User asks: "what runs on commit?", "pre-commit guard", "before commit checks", "why did my commit fail?", "fix commit failure"
- User wants to run the guard manually: `pnpm run before-commit-guard`
- Modifying `.husky/pre-commit` or pre-commit checks — read fe-code-quality-security for consistency

## What Runs on `git commit`

The pre-commit hook (`.husky/pre-commit`) is a one-liner: it runs
`./tooling/validate/before-commit-guard.sh`, which owns **all** labeled steps
under `set -e` — so any failing step reliably blocks the commit (the previous
split hook/script layout let a mid-hook failure fall through). Same pattern as
clinozy-be's `pnpm guard:pre-commit` runner.

### Inside before-commit-guard.sh (steps 1–10)

**Order:** step 3 (lint-staged) runs first, because it rewrites and restages files. The other eleven
only read, so they run **in parallel**, each into its own log, printed afterwards in step order under
its own heading; the guard fails if any of them failed. If the parallel runner itself breaks (no
temporary directory, a step that left no exit code), it says so and runs the eleven one by one. ESLint
and Prettier keep caches under `node_modules/.cache`, and `type-check` is incremental
(`tsconfig.app.json`'s `tsBuildInfoFile`), so a commit with nothing new to check takes about 9 s
(67–78 s before, almost all of it a full `tsc`); the first run after a fresh install still builds the
cache (about 60 s).

1. **validate:env-example** — `.env.example` documents all keys from `src/core/config/env-schema.ts` (via `pnpm tool:sync-env-example`).
2. **validate:public** — Required public assets exist: config.js, theme-init.js, vite.svg, manifest.webmanifest, \_headers, offline.html, robots.txt.
3. **lint-staged** — ESLint --fix + Prettier (both `--cache`) on staged `.ts`, `.tsx`, `.css`, `.json`, `.md`, `.yaml`, `.yml`.
4. **validate:vite-env** — env/mode-sniffing gate: no `import.meta.env.DEV/PROD/MODE` or `platformConfig.environment === '<name>'` / `.MODE ===` outside the config-kernel allowlist. Behavior must be driven by named `platformConfig` flags.
5. **type-check** — `tsc --noEmit --incremental` for the full project (only what changed since the last run is rechecked).
6. **validate:lockfile** — _only when the commit stages `package.json`, `pnpm-lock.yaml` or `pnpm-workspace.yaml`_ — runs `pnpm install --frozen-lockfile` (the exact check CI runs) to prove the lockfile is in sync. Catches a dependency or `overrides` change that forgot to regenerate the lockfile before it can reach main.
7. **Gitleaks** — `gitleaks protect --staged` secret/API-key scan. Mandatory: without gitleaks the commit fails and names the install command (`bash tooling/setup/agent/install-gitleaks.sh` on Linux, `brew install gitleaks` on macOS).
8. **Env-file guard** — reject committing any `.env*` except `.env.example` (mirrors the pr-governance CI guard, locally).
9. **Merge conflict markers** — reject staged files containing `<<<<<<< ` / `>>>>>>> ` / bare `=======` lines (anchored so doc banner lines pass).
10. **Large staged files** — reject staged blobs > 3MB, measured with `git cat-file -s :<path>` (the staged content, not the working tree — rename/partial-stage safe). `iterations/` is exempt: it holds design-tool exports, and a prototype bundle routinely exceeds 3MB. Lives in `tooling/validate/large-staged-files.sh`, pinned by `large-staged-files.test.mjs`.
11. **Dependency audit** — _only when `pnpm-lock.yaml` is staged_ — `pnpm deps:audit:prod` (high and above). An unreachable registry warns and passes (the PR's audit lane runs it).
12. **Client env allowlist** — _only when `src/core/config/env-schema.ts`, `.env.example` or `tooling/validate/client-env.ts` is staged_ — `pnpm validate:client-env --env development` and `--env production` (the deploy workflows' check, at commit).

Steps 11 and 12 are **early checks** (`tooling/ci/early-checks.mjs`, as is Semgrep at push in
`.husky/pre-push`): warn-only until 2026-10-31 (Asia/Calcutta), then a finding blocks. A finding the
user judges wrong goes into `agent-os/evals/warn-only-false-positives.md`, so the rule is tuned
before it blocks.

## How to Fix Failures

### validate:env-example fails

**Error:** "`.env.example` is missing required var(s): NODE_VERSION"

**Fix:** Add the missing key to `.env.example` (or run `pnpm tool:sync-env-example --fix`). See `agent-os/skills/fe-env-schema-add/SKILL.md`.

### validate:public fails

**Error:** "Missing required files in public/: ..."

**Fix:** Add the missing file to `public/`. See `public/README.md` for the full list.

### lint-staged / ESLint fails

**Fix:** Run `pnpm lint:fix` and fix any remaining errors manually. Common issues:

- Import ordering → `simple-import-sort` (auto-fixed)
- Unused imports → remove or use `_` prefix
- `security/detect-object-injection` → add block disable with justification for safe dynamic access
- React purity / impure in render → move to effect or handler

See **fe-lint-guard** skill for full fix patterns.

### type-check fails

**Fix:** Run `pnpm type-check` to see errors. Fix TypeScript errors (strict mode, no `any`, proper types).

### validate:lockfile fails

**Error:** "`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` … The current "overrides" configuration doesn't match the value found in the lockfile" (or a lockfile-outdated error).

**Cause:** You changed a dependency in `package.json` (or an `overrides` entry in `pnpm-workspace.yaml`) without regenerating `pnpm-lock.yaml`. A frozen install then fails — which reds **every** CI job on the PR, and any open release-please PR inherits the mismatch and goes all-red too.

**Fix:** Run `pnpm install`, then stage the changed manifest **and** `pnpm-lock.yaml` in the same commit. **Rule:** a dependency/override change and its lockfile update are one atomic change — a desynced lockfile must never reach main.

## Manual Run

Run the guard without committing:

```bash
pnpm run before-commit-guard
```

This runs only the before-commit-guard checks (env, public, lint-staged, vite-env, type-check, and lockfile sync when `package.json`/`pnpm-lock.yaml` are staged). The env-file guard, gitleaks, conflict markers, and large file checks run only in the actual pre-commit hook. Run the lockfile check directly any time with `pnpm run validate:lockfile`.

## Relationship to Full Health Check

| Check                | fe-before-commit-guard                | pnpm health     |
| -------------------- | ---------------------------------- | --------------- |
| validate:env-example | ✅                                 | ✅              |
| validate:public      | ✅                                 | ✅              |
| format (Prettier)    | ✅ via lint-staged on staged files | ✅ format:check |
| lint                 | ✅ via lint-staged on staged files | ✅ full lint    |
| type-check           | ✅                                 | ✅              |
| tests                | ❌ (too slow for commit)           | ✅              |
| build                | ❌ (too slow for commit)           | ✅              |
| bundle size          | ❌ (needs build)                   | ✅              |
| gitleaks             | ✅ in pre-commit                   | ❌              |
| conflict markers     | ✅ in pre-commit                   | ❌              |
| large file           | ✅ in pre-commit                   | ❌              |

Use `pnpm health` or `pnpm health:fix` for the full path-to-production flow before release.

## Config Files

| File                                      | Purpose                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `tooling/validate/before-commit-guard.sh` | Main guard script                                                       |
| `tooling/validate/lockfile-sync.sh`       | `validate:lockfile` — frozen-install lockfile ↔ package.json sync check |
| `.husky/pre-commit`                       | Invokes guard + gitleaks + conflict + large file                        |
| `package.json` `lint-staged`              | ESLint + Prettier on staged files                                       |
| `src/core/config/env-schema.ts`           | Schema source of truth for env keys                                     |
| `tooling/validate/sync-env-example.ts`    | Schema ↔ `.env.example` parity                                          |

---

## Traps that make the guard look wrong when it is right

**A "lockfile out of sync" error can actually be a Node version mismatch.**
`pnpm-workspace.yaml` sets `engineStrict: true`, and `validate:lockfile` runs
`pnpm install --frozen-lockfile` — which fails on an engine mismatch *before* it
checks the lockfile, while printing the lockfile message. If the lockfile is
genuinely in sync, read the pnpm error body:

```
ERR_PNPM_UNSUPPORTED_ENGINE  Your Node version is incompatible with "<pkg>"
```

Fix the Node version (`nvm use <version>` matching `.nvmrc` and every dependency's
`engines`), not the lockfile. Regenerating a healthy lockfile to chase this
creates real churn.

**A rejected commit leaves the index populated.** If an attempt ran `git add -A`
and the hook failed, those paths are still staged — the next narrowly-scoped
`git add` silently includes them, producing a commit whose message describes a
fraction of its contents.

```bash
git status --short      # before every commit
git show --stat HEAD    # after: does it match the message?
```

`git reset` (mixed) clears the index without touching the working tree. See
`agent-os/skills/fe-safe-bulk-edits/SKILL.md` for the full staging discipline.

**Never conclude a gate passed from a piped command.** `pnpm lint | tail -5`
reports `tail`'s status. Capture it: `cmd > /tmp/out 2>&1; echo $?`.
