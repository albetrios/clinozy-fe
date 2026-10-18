---
description: Watch a PR — triage CI failures and review comments until it is green
argument-hint: <pr-number>
allowed-tools: Bash(git*), Bash(gh*), Bash(pnpm*)
---

Watch PR **$ARGUMENTS** and keep it merge-ready:

1. Subscribe to PR activity (`subscribe_pr_activity`) so CI, reviews and comments wake this session — never poll `gh pr view`, `gh pr checks`, the API or `sleep`. After a push from the CLI, the `fe-push-ci-watch.mjs` hook wakes the session when a run of the pushed commit fails (it needs an authenticated `gh`).
2. On a red CI event: start **fe-ci-investigator** at once, in the background — one agent per failing check, told the PR, the check and its run id — and do not read the logs yourself meanwhile. The failing lane sits in the **`Quality gate`** rollup (the second required context, **`Checks`**, aggregates the CodeQL/Trivy checks; `.github/workflows/pr-ci.yml`). When it reports, apply its fix plan in scope, push, update the status checklist.
3. On a review comment: if the fix is unambiguous, apply + push; if not, ask the user.
4. On a merge conflict or new push: rebase or resolve against **`main`**, then re-verify with `/fe-validate` or `pnpm health`.
5. On green with the approvals in: **/fe-merge-pr** turns on GitHub auto-merge (once is enough —
   GitHub merges when both required contexts pass).

Keep going until the PR is MERGED or CLOSED, or the user says stop. Reply only when something needs the user; otherwise let the PR diff be the record.
