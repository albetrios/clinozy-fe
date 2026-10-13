# Dependency upgrades and audits

Use this as the **operational checklist** when triaging versions and security reports.

## Commands

| Command           | Purpose                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm deps:check` | Lists outdated direct dependencies (`pnpm outdated`). Exit code `1` when anything is outdated — expected during triage. |
| `pnpm deps:audit` | Reports known vulnerabilities (`tooling/ci/bulk-audit.mjs` against npm's bulk advisory endpoint; high+ fails).          |
| `pnpm validate`   | Run after bumping packages: lint, type-check, unit tests.                                                               |

## Dependabot

Weekly npm updates are configured in [`.github/dependabot.yml`](../../.github/dependabot.yml), grouped **by risk** (same shape as clinozy-be):

| Group              | Contents                       | Merge path                                                                                                                                                                                     |
| ------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm-non-major`    | patch + minor, prod + dev deps | **Approval-triggered auto-merge**: approve the PR and [`dependabot-auto-merge.yml`](../../.github/workflows/dependabot-auto-merge.yml) arms squash auto-merge; it lands when PR CI goes green. |
| `npm-major`        | major upgrades                 | Manual review + merge.                                                                                                                                                                         |
| `security-updates` | Dependabot security PRs        | Manual review + merge (prioritize per `SECURITY.md`).                                                                                                                                          |
| `actions`          | github-actions bumps           | Manual review + merge.                                                                                                                                                                         |

The approval is the manual gate — `main` requires 0 approvals (solo-maintained; an author can't approve their own PRs, but a maintainer can approve Dependabot's), so approving a low-risk group PR is the explicit opt-in signal. Failed CI on any Dependabot PR opens a triage issue via [`dependabot-ci-triage.yml`](../../.github/workflows/dependabot-ci-triage.yml). The `@tanstack/react-router` minor/major pin below is enforced via a Dependabot `ignore` rule.

**Prefer merging Dependabot PRs** over ad-hoc bumps, then run `pnpm validate` on the branch.

## Node.js (runtime)

- **`package.json` → `engines.node`:** `>=24.15` — **Active LTS** only (currently the **24.x** line). Do not target odd/current non-LTS releases for CI or deploy defaults.
- **`.nvmrc` / `.node-version`:** `24.21.0` (latest 24 LTS) — use `nvm install` / your version manager so local, CI (`actions/setup-node` reads `.nvmrc`) and agent sandboxes run the same release.

## pnpm overrides (transitive CVEs)

[`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) defines `overrides` to force patched versions where upstream has not yet bumped (pnpm 11+ ignores the old `pnpm.overrides` field in `package.json`):

| Override                           | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `protobufjs` **>=7.6.4 <8**        | `posthog-js` → OpenTelemetry OTLP stack pulls it transitively (tree-shaken out of the shipped bundle). Floors past the `<=7.5.7` unbounded-recursion DoS advisory; bounded to the 7.x line (the `<8` ceiling keeps the same-major intent while letting patches flow).                                                                                                                                                                                                                                                                                                    |
| `basic-ftp` **>=5.3.1 <6**         | Originally for `@size-limit/preset-app` → puppeteer → `get-uri`, which pulled an older `basic-ftp` (path traversal / DoS advisories). **That path was removed** (see the decisions log), so nothing in the tree resolves `basic-ftp` today and the floor is currently inert. Retained deliberately as defence-in-depth: it costs one line, it re-arms automatically if any future dependency pulls `basic-ftp` back in, and it is pinned by `tests/security/static-security-config.security.test.ts`. Bounded floor on the 5.x line — allows patches, not the 6.x major. |
| `minimatch` **>=10.2.5 <11**       | `eslint-plugin-sonarjs` v3 pulled vulnerable `minimatch@10.1.x` (ReDoS). **v4** of the plugin is now direct; the bounded floor keeps the tree on a patched 10.x line.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `@opentelemetry/core` **>=2.8.0**  | `netlify-cli` → `@netlify/blobs` → `@netlify/otel` pulled `@opentelemetry/core@2.7.1`, hit by GHSA-8988-4f7v-96qf (unbounded memory allocation). Dev/deploy CLI only — never shipped to clients — and below the `--audit-level=high` gate, so this is a floor rather than an exact pin.                                                                                                                                                                                                                                                                                  |
| `@fastify/static` **>=10.1.2 <11** | `netlify-cli` pulled `@fastify/static@9.1.3`, hit by GHSA-83w8-p2f5-377r (route-guard bypass via path traversal) and GHSA-8pvw-jcv7-9cmj (authorization bypass via non-canonical URL paths — fixed only in **10.1.2**). Dev-only CLI; bounded to the 10.x line.                                                                                                                                                                                                                                                                                                          |
| `brace-expansion` **>=5.0.8 <6**   | Reached through the `minimatch` override's 10.x line; `<5.0.8` is hit by GHSA-mh99-v99m-4gvg (unbounded expansion → OOM DoS). Bounded floor on the 5.x line.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `fast-uri` **>=3.1.4 <4**          | `netlify-cli` → `fastify` / `ajv` pulled `fast-uri@3.1.2`–`3.1.3`, hit by GHSA-v2hh-gcrm-f6hx and GHSA-4c8g-83qw-93j6 (host confusion). Bounded to 3.x — the 4.x major is a separate upgrade.                                                                                                                                                                                                                                                                                                                                                                            |
| `find-my-way` **>=9.7.0 <10**      | `netlify-cli` → `fastify@5` pulled `find-my-way@9.6.0`, hit by GHSA-c96f-x56v-gq3h (HTTP/2 DDoS). Bounded floor on the 9.x line.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `js-yaml@5` **>=5.2.2 <6**         | `markdownlint-cli2` pulled `js-yaml@5.2.1`, hit by GHSA-pm4m-ph32-ghv5 (exponential flow-collection parsing → DoS). Scoped to the **5.x** selector so `cosmiconfig`'s unaffected `js-yaml@4` tree is left alone.                                                                                                                                                                                                                                                                                                                                                         |
| `postcss` **>=8.5.18 <9**          | A stale `postcss@8.5.14` remained in the dev tree, hit by GHSA-r28c-9q8g-f849 (path traversal in `sourceMappingURL` auto-loading). Bounded floor on the 8.x line.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `sharp` **>=0.35.1 <0.36**         | `netlify-cli` → `@netlify/images` → `ipx` pulled `sharp@0.34.5`, which inherits the libvips CVEs in GHSA-f88m-g3jw-g9cj. Dev-only image pipeline; bounded to the 0.35.x line.                                                                                                                                                                                                                                                                                                                                                                                            |
| `svgo` **>=4.0.2 <5**              | `netlify-cli` pulled `svgo@4.0.1`, hit by GHSA-2p49-hgcm-8545 (`removeScripts` leaves executable scripts intact). Bounded floor on the 4.x line.                                                                                                                                                                                                                                                                                                                                                                                                                         |

Revisit these when Dependabot or direct dependency upgrades remove the need.

## Test DOM compatibility

Keep `jsdom` pinned exactly to `30.0.1` until a replacement passes the ordinary
interaction suites below and `pnpm test:ci`. During PR #290 verification on
2026-09-20, `30.1.0` failed 14 tests across these suites; changing only jsdom to
`30.0.1` passed all 27 tests and the full 2,336-test coverage run. The failures
depend on repeated menu interactions: a test can pass alone and fail after a
preceding menu opens and unmounts. This is a measured compatibility constraint,
not a confirmed diagnosis of an upstream defect.

```bash
pnpm exec vitest run --project unit src/shared/components/OrganizationSwitcher/OrganizationSwitcher.test.tsx src/shared/components/SettingsModal/organization/OrganizationMembersPanel.test.tsx src/shared/components/DataTable/DataTable.test.tsx src/shared/components/DateTimePrefsCard/DateTimePrefsCard.test.tsx
pnpm test:ci
```

PR #290 ran the shared `MembersTable` suite; that component was removed as dead code.
Its menus now live in `OrganizationMembersPanel` (row actions) and the `DataTable` kit
suite (column sort), so those two stand in for it. They were not re-run against
`30.1.0`.

Before removing the pin, run these commands on the actual regenerated lockfile,
without a module-resolution hook or test-only dependency substitution. Preserve
the user-event interactions and assertions; do not hide the regression with
mocks, skipped tests, or lower coverage thresholds. Commit the manifest and
lockfile together and re-run the normal push hooks.

## Pins and known constraints

### Upgrade Verification Contract

Treat compatibility, unused-export cleanup, and startup performance as separate
checks. Reproduce failures on the actual installed graph and inventory all callers
before removing an export, including fixtures and source-reading tooling. Keep a
runtime schema when it validates values; a private declaration used only for type
inference can become an equivalent TypeScript type after compatibility checks.

For loading changes, keep available shell controls visible, wait for the required
translation namespaces, and verify delayed or failed chunks without losing
notification actions or errors. Measure production startup bytes and browser
behavior; an eager dynamic import does not remove work from startup. Preserve
budgets and coverage thresholds, regenerate affected docs, run normal hooks, and
report any existing skipped test separately from verified fixes.

The shared procedures are maintained in the
[fe-dependency-management](../../agent-os/skills/fe-dependency-management/SKILL.md),
[fe-platform-hygiene](../../agent-os/skills/fe-platform-hygiene/SKILL.md), and
[fe-bundle-performance](../../agent-os/skills/fe-bundle-performance/SKILL.md) skills.

### Dependency Constraints

- **`@tanstack/react-router`** is pinned to the **1.170.x** line (`~1.170.17` in [`package.json`](../../package.json)). The earlier **1.169** minors that caused unhandled navigation rejections and maximum update depth in guard tests are resolved as of **1.170.17** — verified against the full guard + unit suite (96 guard tests, 1291 unit tests, build + `build:check` all green) in the 1.160→1.170 bump. Minor/major bumps on this fast-moving router still go through a **deliberate spike** (Dependabot `ignore` keeps them off auto-merge); patches within `~1.170.x` flow normally.
- **React 19**, **Vite 8**, **ESLint 10**, **lucide-react 1.x**, and similar **majors** are intentionally **not** part of routine bumps — schedule separately with full `pnpm validate` and E2E. **`netlify-cli`** is kept current on the **v27** line (dev-only CLI; moved off v26 in the npm-major group bump — v27 drops Node 20 and requires 22.13+, which the repo's `engines.node >=24` already satisfies).

## Audit noise

`pnpm deps:audit` (npm bulk advisory endpoint — the legacy `pnpm audit` endpoints
were retired by the registry in July 2026; pnpm ships bulk support only from v11)
should report **no high/critical** after overrides; **moderate** issues may remain
in dev-only trees. Treat **production `dependencies`** first (`pnpm deps:audit:prod`
audits the prod-reachable graph only); document accepted risk for dev-only
transitives if no patched upgrade exists yet.

### CI posture — which audit blocks a merge

The `Security audit` lane runs both, in this order:

| Step                          |   Blocking    | Why                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | :-----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm deps:audit:prod`        |    **Yes**    | These packages ship to users. Runs **first** so it is always reported — when the full-tree sweep ran first and failed, this step was skipped, so the audit that matters was never evaluated.                                                                                                            |
| `pnpm deps:audit` (full tree) | No — advisory | A dev-only advisory with **no published fix** would otherwise wedge every PR with no honest exit: `bulk-audit.mjs` has no waiver list by design, and the alternative is dropping the offending tool. Failures stay visible in the job log, and `scheduled-deps-audit.yml` re-runs the full tree weekly. |

Make the full-tree step blocking again once the accepted-risk list below is empty.

### Accepted risk — dev-only, no upgrade available

| Advisory                                                                                                                              | Path                                                                                                                                                                                              | Why accepted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `braces` **<=3.0.3** — stack-exhaustion DoS through deeply nested brace patterns (GHSA-vfj7-8cjw-p6xm)                                | `micromatch@4` ← `netlify-cli` (`@netlify/git-utils`, `http-proxy-middleware`, `fast-glob` ← `@netlify/zip-it-and-ship-it`), `shadcn` (`fast-glob`, `ts-morph`), `markdownlint-cli2` (+ `globby`) | **3.0.3 is the newest published version**, and `micromatch` 4.0.8 — its newest — declares `"braces": "^3.0.3"`: there is nothing to upgrade or pin to. Dev/tooling only: `pnpm deps:audit:prod` is clean, so it never reaches a client bundle. The patterns expanded on these paths are the repo's own globs (markdownlint, shadcn, Netlify config), not attacker input. None of the three tools can be dropped: `netlify-cli` for the reason in the row below, `shadcn` is the component CLI and `markdownlint-cli2` the docs lane. Re-check when `braces` publishes >3.0.3.                                                                                                                                                                                                                                                        |
| `node-forge` **<=1.4.0** — RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements (GHSA-86w9-cpqp-85rv) | `netlify-cli` → `@netlify/dev` / `@netlify/images` → `ipx@3` → `listhen`                                                                                                                          | **1.4.0 is the newest published version**, and `listhen` 1.10.1 — its newest — declares `"node-forge": "^1.4.0"`: there is nothing to upgrade or pin to. `listhen` uses `node-forge` only to **create** a self-signed HTTPS certificate for the local `netlify dev` image server (`pki.createCertificate`, `rsa.generateKeyPair`); nothing on this path verifies a third-party signature, which is where the flaw lies. Dev/deploy-CLI only: `pnpm deps:audit:prod` is clean. `netlify-cli` cannot simply be dropped — `pnpm exec netlify deploy` in `reusable-netlify-deploy.yml` **is** the production deploy path, and moving it to `pnpm dlx` would unpin a deploy-critical tool to silence a dev-only finding. Re-check when `node-forge` publishes >1.4.0, or when `@netlify/images` moves to `ipx` 4 (which drops `listhen`). |

`image-size` <=2.0.2 (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq) and `extract-zip` <=2.0.1
(GHSA-jmr9-qjv8-65gv), the two earlier entries, left the tree with later `netlify-cli`
releases — neither is in `pnpm-lock.yaml` any more.

While this list is not empty, the weekly `scheduled-deps-audit.yml` run is **red by
design**: its full-tree step is blocking, because a scheduled run blocks no merge and a red
run is how a finding stays visible.

## Upgrade decisions log

### Advisory floors — seroval, source-map-js, MCP SDK (2026-10-13) — ADOPTED

- **What:** three `overrides` floors in `pnpm-workspace.yaml`, all dev/tooling paths
  (`pnpm deps:audit:prod` was already clean):
  - `seroval` **>=1.6.3 <2** — CRITICAL GHSA-p6vx-979v-rg4c (`>=0.12.0 <=1.6.0`) and HIGH
    GHSA-jp82-f5mq-hwhp (`<=1.6.2`). The vulnerable 1.5.6 came through `solid-js` 1.9.15 ←
    `@tanstack/query-devtools`; the router's own copy was already 1.6.8. `solid-js` 1.9.15
    declares `~1.5.4`, but only its SSR entry (`solid-js/web/dist/server.js`) imports
    `seroval` — the client-side devtools never load it.
  - `source-map-js` **>=1.2.2 <2** — HIGH GHSA-68fv-2mgg-jv7q (`>=1.0.0 <1.2.2`), through
    `@tailwindcss/node` and `postcss`; both declare `^1.2.1`, so 1.2.2 is in range.
  - `@modelcontextprotocol/sdk` **>=1.31.0 <2** (was `>=1.30.0`) — HIGH GHSA-6qxp-vccf-f47h
    (`>=1.12.0 <1.31.0`), through `shadcn` and `tailwindcss-mcp-server`. Bounded below the
    next major like the other floors.
- **Accepted, not fixed:** `braces` and `node-forge` — no patched version is published;
  see the accepted-risk table above.
- **Lockfile side effects** of the re-resolution `pnpm install` performs when `overrides`
  change: `web-vitals` 6.2.2 → 6.2.3 (patch, within `^6.2.2`, deduped onto the copy
  `@sentry/browser` already used), the stray `@types/node` 24.19.0 peer copies deduped onto
  the declared 24.19.1, and the `libc` fields pnpm 12.8.1 writes for the `@rollup/*` native
  binaries restored.
- **Pinned** by `tests/security/static-security-config.security.test.ts`.

### `@size-limit/preset-app` removed — drops the puppeteer subtree (2026-08-18) — ADOPTED

- **What:** dropped the `@size-limit/preset-app` devDependency. The preset is only
  `@size-limit/file` + `@size-limit/time` + `size-limit`, and **all three of those were
  already declared directly** in `package.json` — so its sole unique contribution was
  `@size-limit/time`.
- **Why it was safe:** `@size-limit/time` was never used. The runner
  (`tooling/ci/run-size-limit.mjs`) measures file size only and explicitly set
  `running: false`; there has never been a `time` budget in this repo.
- **Security payoff:** `@size-limit/time` → `estimo` → `find-chrome-bin` /
  `puppeteer-core` → `@puppeteer/browsers` was one of the two paths pulling
  **`extract-zip`** (GHSA-jmr9-qjv8-65gv). That path is gone; only the `netlify-cli`
  path remains, and it cannot be removed. The alert itself therefore stays open — this
  shrinks exposure, it does not close the finding.
- **`basic-ftp` override kept, not removed.** It existed solely for `preset-app` →
  puppeteer → `get-uri`, so with that subtree gone it is now inert. It stays anyway: a
  CVE floor is one line, it re-arms if anything pulls `basic-ftp` back in, and
  `tests/security/static-security-config.security.test.ts` pins it. Dropping a
  protective floor as collateral of a tooling cleanup is the wrong trade — prune inert
  overrides deliberately, as their own change, not as a side effect.
- **`running: false` had to go too.** It is an option _contributed by_
  `@size-limit/time`; without the plugin, size-limit hard-fails with
  `Config option running needs @size-limit/time plugin`. Removed from both
  `run-size-limit.mjs` and `.size-limit.json`, with a comment so it is not re-added.
- **Measured** (against `main` at the npm-non-major bump, #248): lockfile
  **1783 → 1760 packages** (23 removed). `pnpm size` after a full build:
  **JS 220.28 kB / 225 kB**, **CSS 22.41 kB / 25 kB** — budgets unchanged and still
  green.

### npm-major group — web-vitals 6, jest-dom 7, netlify-cli 27, size-limit 13 (2026-08-01) — ADOPTED

- **`web-vitals` 5.3 → 6.0** is the only **production** dependency in the group.
  `src/app/observability/performance.ts` imports `onCLS`/`onFCP`/`onINP`/`onLCP`/`onTTFB`
  from the **standard** entry point — all five survive v6 unchanged. The two breaking
  changes do not reach this codebase: the `includeProcessedEventEntries` default flip
  affects only the **attribution** build (not imported here), and the
  `verbatimModuleSyntax` module cleanup is covered by the type-check lane
  (`import type { Metric }` still resolves). Soft-Navigation support is opt-in.
- **`@testing-library/jest-dom` 6.9 → 7.0** now requires `@testing-library/dom` as a
  real peer (already direct via `@testing-library/react`) and Node ≥ 22 — satisfied by
  `engines.node >=24`.
- **`netlify-cli` 26 → 27** and **`size-limit` 12 → 13** are dev-only; both drop Node 20,
  which this repo never targeted.
- Verified by the full `Quality gate` (1651 unit tests, build + preload/size budget,
  lint/biome/tsc, security lanes). **E2E was not run** — that lane is local-only and
  needs clinozy-be on `:3000`.

### React 19 + React Compiler (2026-06-12) — ADOPTED

- `react`/`react-dom` 18.3 → 19.2 with `@types/react*` 19: **zero** type or
  test changes needed (plain-function components, no `forwardRef`, strict
  types throughout made the codebase forward-compatible).
- **React Compiler** enabled in `vite.config.ts` via
  `babel-plugin-react-compiler` — automatic memoization at build time;
  verified active (`useMemoCache` present in the production bundle). The
  `eslint-plugin-react-hooks` v7 rules already lint for compiler
  compatibility (`react-hooks/incompatible-library` warnings on TanStack
  Table test harnesses are expected — those components skip compilation).
- **Deliberately NOT enabled in `vitest.config.ts`**: the compiler's
  synthetic memo-cache checks tripled the branch denominator
  (1,240 → 3,750) and made the coverage ratchet measure compiler internals
  instead of source. Unit coverage stays on source semantics; compiled
  output is exercised by the e2e suite (20 specs) and the production build.
- Coverage ratchet raised on the upgrade's real gains: functions 52 → 56,
  lines 57 → 60, statements 57 → 59 (branches hold at 53).
