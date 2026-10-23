---
name: fe-pr-babysit
description: Keep a clinozy-fe PR merge-ready — triage review comments, resolve conflicts, fix CI in a loop. Use when the user asks to babysit a PR, make it green, fix CI on a PR, or get it merge-ready.
---

# PR babysit (clinozy-fe)

Get the current PR to **mergeable + green CI + review comments addressed**, then **merge it when
green** (on the user's go-ahead). This is clinozy-fe's babysit skill: agent-os names carry the
`fe-` prefix, so there is no bare `babysit` (or `steward`) skill. clinozy-be's is **be-pr-babysit**.

Command: `/fe-watch-pr <n>` (the watch loop) · `/fe-merge-pr <n>` (auto-merge once green).

## Preconditions

- Read PR state, checks and threads with the GitHub tools (or `gh`) — once, never in a polling loop.
- Subscribe to the PR's activity (`subscribe_pr_activity` where it exists): CI results, reviews,
  conflicts and the merge wake the session; after a push from the CLI, the `fe-push-ci-watch.mjs`
  hook wakes it when a run fails. Where neither exists, one safety-net check-in replaces any timer.
- Base branch: `main`. The two required contexts are **`Quality gate`** (the rollup of the PR CI
  lanes, `.github/workflows/pr-ci.yml`) and **`Checks`** (CodeQL / Trivy).
- Merge policy: [`.github/CLAUDE.md`](../../../.github/CLAUDE.md) — never merge on red, no bypass.

## Workflow

### 1. Assess PR state

- Merge state, CI on the **latest** head commit, and unresolved review threads only.
- If the branch conflicts with `main`, resolve that first (step 2): CI on a conflicted head proves
  nothing.

### 2. Merge conflicts

- Merge `main` into the branch (never rebase or force-push a branch someone else pushed to);
  regenerate `pnpm-lock.yaml` with `pnpm install`, never by hand — a dependency change and its
  lockfile are one commit (`pnpm run validate:lockfile`).
- If both sides changed the same logic and picking either loses behavior, stop and ask the user.

### 3. CI failures (fix in scope only)

On a red check, start **fe-ci-investigator** in the background — one per failing check (the PR,
the check, its run id) — and act on its root cause and fix plan instead of reading the logs
yourself. The failing lane sits inside the `Quality gate` rollup.

| Lane                    | Reproduce locally                                                            |
| ----------------------- | ---------------------------------------------------------------------------- |
| Lint / types            | `pnpm lint`, `pnpm biome:check`, `pnpm type-check`                           |
| Unit / CI policy tests  | `pnpm test` or the failing file: `pnpm exec vitest run <path>`              |
| Knip / build / size     | `pnpm knip`, `pnpm build --defaults && pnpm build:check && pnpm size`        |
| Docs ↔ code drift       | `pnpm sync:check`, `pnpm docs:lint:changed`                                  |
| Everything              | `pnpm health` (all phases)                                                   |

**Never** skip, disable or quarantine a test, weaken a workflow, or push an empty commit to make red
go green. A flaky check is re-run once to confirm; a second failure is real. A failure in code the
PR does not touch that is red on `main` too is reported, not widened into this PR.

After fixes: run the lane's local command, then `git push` (the pre-push hook runs the fast gates),
and wait for the next PR event — the push's CI result arrives as one.

### 4. Review comments

- Work the threads with **fe-review-response** — verify every claim against the code, including the
  ones a review marks resolved; fix real findings in touched files.
- Reply on each thread you addressed (or why not), then resolve it.

### 5. Merge when green

- Only when **both required contexts are green**, the PR is mergeable, and the user asked to merge
  (or to "merge when green"): **/fe-merge-pr** turns on GitHub auto-merge with squash — the PR title
  becomes the squash commit, so it must be a Conventional Commit.
- Green but waiting on a human approval is not yours to push past: say once that it waits on its
  reviewers.

## Verify

The PR's checks on its latest head commit: `Quality gate` ✓ and `Checks` ✓, no merge conflict, no
unresolved thread waiting on you.

## Related skills

- **fe-review-response** — working review threads to completion
- **fe-pre-pr-sweep** — before opening the PR
- **fe-before-commit-guard** — a commit the guard refuses
- **fe-code-quality-security** — what each CI lane runs
