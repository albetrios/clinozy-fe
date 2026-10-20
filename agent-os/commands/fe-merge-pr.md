---
description: Merge a PR on green — turn on GitHub's own auto-merge (squash)
argument-hint: <pr-number>
allowed-tools: Bash(git*), Bash(gh pr merge*), Bash(gh pr view*)
---

Merge PR **$ARGUMENTS** on green, through GitHub's own auto-merge:

1. Confirm there is no merge conflict with **`main`**. The branch need not be up to date — the
   `main` ruleset does not require it (`strict` is off).
2. Turn on auto-merge with squash: `gh pr merge --auto --squash <n>`, or the GitHub MCP
   `enable_pr_auto_merge` (merge method `SQUASH`); the PR title becomes the squash commit. GitHub then
   merges the moment both required contexts — **`Quality gate`** + **`Checks`** — pass and the
   required approvals are in; it waits on its own, so there is nothing to poll. No `--delete-branch`:
   the cloud git proxy rejects every branch delete, and the squash-merge deletes the branch anyway.
3. Report that auto-merge is on, and the merge when the PR event arrives (/fe-watch-pr).

Never merge around a red or pending required check: no `--admin`, no merge API call that skips a
gate. A check that stays red is fixed or re-run, never bypassed.
