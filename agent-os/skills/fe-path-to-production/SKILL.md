---
name: fe-path-to-production
description: Take main to production: readiness plan, Release PR, the deploy the user approves, live check, rollback; after clinozy-be. Use to release, deploy, go live. Command /fe-release.
trigger: docs/deployment/path-to-production.md
triggerNote: Or the user asks to release / deploy to production / path to production — the readiness plan the user approves, then the Release PR, the approved deploy and the live check
---

# Path to production (clinozy-fe)

One procedure from a green `main` to a live production frontend. Command:
**`/fe-release`** (`review` stops after step 1, `release` skips it). clinozy-be runs the same steps
for the API: skill **be-path-to-production**, command **`/be-release`**.

**Gate doc:** [docs/deployment/path-to-production.md](../../../docs/deployment/path-to-production.md)
(go / no-go: [production-readiness.md](../../../docs/deployment/production-readiness.md)).

## The order between the two repositories

The frontend goes **after** clinozy-be whenever this release calls anything new in the API (a
parameter, a field, a route). clinozy-be's query DTOs are `.strict()`, so a frontend that sends a
parameter the live backend does not know gets a 400 on every such read (24 Oct:
`exclude_appointment_id` would have broken every Reschedule grid against backend v9.3.0). Before
step 2, check what the release sends that the live backend may not know: the
`src/core/http/openapi-types.d.ts` diff since the last tag. If the backend release is needed, it must
report **Environment fully live** first.

## Never

- Approve a production deployment, or ask an agent to: the `production` environment's reviewer
  approves it in GitHub (Actions → the run → **Review deployments**).
- Merge a Release PR on red, or with `--admin`.
- Run any production action before the user has seen and confirmed the step 1 plan, unless the
  user explicitly says to release without it.

## Step 1 — Readiness review and the plan the user approves

Run **`/fe-prod-readiness`**, the `fe-prod-readiness` pipeline in `agent-os/agents/pipelines.json`
(`fe-dependency-auditor`, `fe-production-hardening-reviewer`, `fe-bundle-size-reviewer`,
`fe-perf-auditor`), over `git log --oneline <last tag>..origin/main`, and add:

- the go / no-go list in [production-readiness.md](../../../docs/deployment/production-readiness.md)
  and the [pre-launch checklist](../../../docs/deployment/deployment-and-pre-launch.md#pre-launch-checklist);
- what leaves for third parties: the telemetry scrub (`src/lib/telemetry-scrub.ts`, a URL leaves with
  its path only) and the Sentry `beforeSend`; on 24 Oct this review found patient searches still
  reaching Sentry through an error's extras and contexts;
- the backend order check above.

Present the plan — Summary, Satisfied, Gaps (critical and major block), Optional improvements, Next
step — then ask: "Please review this plan. Should we address the gaps first, or proceed to the
release?" Wait for the answer.

## Step 2 — Open the Release PR

An ordinary merge to `main` deploys development only; it never opens a Release PR. Ask for one:

```bash
gh workflow run post-merge-ci.yml -R albetrios/clinozy-fe -f release_pr=true -f skip_deploy=true
```

(Or Actions → **Post-merge CI** → Run workflow → tick `release_pr`.) release-please opens
**`chore(main): release X.Y.Z`** within minutes. Check first that the post-merge CI and **E2E
against the backend image** of `main`'s head are green.

## Step 3 — Check and merge the Release PR

- It changes three files: `package.json`, the release-please manifest and `CHANGELOG.md`. Read the
  changelog: the bump (`feat` → minor, `fix` → patch, `!` → major) and the PRs it lists.
- Auto-merge is **off** in this repository: squash-merge it by hand once `Quality gate` and `Checks`
  are green (`gh pr merge <n> --squash`). Keep the title: the merge commit must start with
  **`chore(main): release`**, which is what makes its post-merge run cut the tag and the GitHub Release.

## Step 4 — The production deploy and its approval

Publishing the Release starts **Release deploy (production)** (`release-deploy.yml`), pinned to the
tag: resolve the release tag → resolve the deploy target → **Netlify deploy (production)**, which
waits for the `production` reviewer. Tell the user it is ready to approve, with the run link.

## Step 5 — Watch it to live

The deploy job, in order:

- validates the deploy secrets and the client env (`VITE_*`);
- builds;
- signs the production bundle and its SBOM, and verifies both signatures, so only the verified
  bytes ship;
- deploys to Netlify;
- runs the **post-deploy smoke**;
- **probes the live CSP and HSTS**.

A green run means live.

## When a deploy fails

- Read the failed step's log first (`fe-ci-investigator` keeps a long log out of the conversation).
- **A secret the step names**: the owner replaces it in GitHub → Settings → Environments →
  production. Rotating a development secret means rotating production's too.
- Re-run on the same run: **Re-run failed jobs**; the approval prompt appears again. Or redeploy a
  tag: `gh workflow run release-deploy.yml -R albetrios/clinozy-fe -f tag=vX.Y.Z`.

## Rollback

Actions → **Rollback deploy** (`rollback-deploy.yml`): an instant restore of a published Netlify
deploy behind the production approval, never a rebuild. Leave `deploy_id` empty for the previous
production deploy.

## Related

- **fe-pr-babysit** — the PRs that lead here; `/fe-ship` gets a branch to `main`, `/fe-release` gets
  `main` to production.
- **fe-code-quality-security**, **fe-bundle-performance**, **fe-dependency-management** — what the
  step 1 findings hand off to.
- **be-path-to-production** (clinozy-be) — the backend half; same steps, same order rules.

## Maintaining this skill

A change to `post-merge-ci.yml`, `release-deploy.yml` or `rollback-deploy.yml` (inputs, job names, the
approval) goes into steps 2–5 and the rollback, here and in clinozy-be's **be-path-to-production**,
so both stay one procedure.
