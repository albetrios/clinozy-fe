---
description: Take main to production — readiness plan, Release PR, the approved production deploy, live check
argument-hint: '[review | release] — no argument runs both; review stops after the plan; release skips it'
allowed-tools: Bash(git*), Bash(gh*), Bash(pnpm*)
---

Follow the **fe-path-to-production** skill (`agent-os/skills/fe-path-to-production/SKILL.md`) from a
green `main` to a live production frontend:

1. **Readiness review and plan** — the skill's step 1 (`/fe-prod-readiness` runs its review
   pipeline). Present the plan and wait for the user's go. `review` stops here.
2. **Backend first** — when this release calls anything new in the API, the clinozy-be release
   (**`/be-release`** in that repository) must be live before step 3.
3. **Release PR** — `gh workflow run post-merge-ci.yml -f release_pr=true -f skip_deploy=true`, then
   wait for `chore(main): release X.Y.Z`.
4. **Merge it** when `Quality gate` and `Checks` are green (squash by hand, title kept; auto-merge is
   off here).
5. **Production deploy** — tell the user when **Release deploy (production)** waits for their
   approval, with the run link. Never approve it yourself.
6. **Live** — watch the run to green: Netlify deploy, post-deploy smoke, live CSP and HSTS probe. On a
   failure, read the step's log and follow the skill's "When a deploy fails".

`release` (**$ARGUMENTS**) skips step 1 only when the user has said so.
