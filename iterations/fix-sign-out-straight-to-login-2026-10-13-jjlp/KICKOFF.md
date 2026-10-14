# Sign out goes straight to the login screen — kickoff plan

> **Status: approved on 2026-10-13** under the user's request to fix it, commit and push, with their
> final confirmation before any PR (D8). Every RED and AMBER is in
> [`plans/decisions.md`](plans/decisions.md) and can be reopened by moving the iteration back to
> `planning`. `fe-kickoff-iteration` builds §6 in ledger order (§9); what was actually built goes in
> `AS-BUILT.md`. clinozy-be has no part in it (D6).

## 1. Header

| Field            | Value                                                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Iteration · mode | `iterations/fix-sign-out-straight-to-login-2026-10-13-jjlp/` · **incremental** (type `fix`, Baseline `launch-2026-09-30-jxmr`, D7)                                                                                           |
| Intake           | mode `brief` · note "1 received (BRIEF.md) · 22 carried forward from launch-2026-09-30-jxmr" · placed 2026-10-13 · Intake hash `3bc02dce1e27` · Schema-routes `5f90325208e1`                                                 |
| Date             | 2026-10-13                                                                                                                                                                                                                   |
| Sources          | `intake-files/BRIEF.md` (the change list); the carried-forward launch drop (unchanged — `iteration:diff`: only `BRIEF.md` added), of which `shell.md:60` (Log out) and `splash.md` (the boot splash) are the screens touched |
| Evidence         | `BRIEF.md:n` = brief line n · `path:n` = this repo before the change                                                                                                                                                         |
| Planned by       | `fe-iteration-planning` (this file)                                                                                                                                                                                          |
| Built by         | `fe-kickoff-iteration`, driving the skills named per ledger row (§9)                                                                                                                                                         |
| Sibling          | none — clinozy-be is unchanged (D6)                                                                                                                                                                                          |

## 2. Locked decisions

All in [`plans/decisions.md`](plans/decisions.md), locked with the approval on 2026-10-13.

| #   | Decision                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | The app stays exactly as it is until the login screen replaces it, with nothing in between                                                                             |
| D2  | The sign-out stays a **full page load** of `/login` — the one guarantee that nothing a module holds in memory reaches the next person                                  |
| D3  | What the screen shows is cleared on `pagehide`; the token, its timer, the session hint and saved onboarding progress at once; a back/forward-cache restore loads again |
| D4  | The `/login` load after a sign-out skips the boot splash (one-shot sessionStorage key → `public/splash-init.js` → `html.app-splash-skip`); every other load keeps it   |
| D5  | A sign-out still owed to the server is finished **behind** the login screen; sign-in requests wait for it (`settlePendingRevoke` in `auth-api.ts`'s `authFetch`)       |
| D6  | clinozy-fe only; branch `fix/sign-out-straight-to-login`                                                                                                               |
| D7  | Baseline `launch-2026-09-30-jxmr`; no other iteration referenced, carried or edited                                                                                    |
| D8  | Built on the user's request; the user's final confirmation comes before any PR, and `frozen` waits for it                                                              |
| D9  | Asking about unsaved changes before signing out is out of scope                                                                                                        |

## 3. Foundation (before any screen)

n/a — no theme, shell, store or icon change. The one new file at the edge of the app is
`public/splash-init.js`, a pre-paint script beside `theme-init.js` and `locale-init.js` (CSP
`script-src 'self'`, precached by the service worker's `**/*.js`), registered in
`tooling/validate/public-assets.sh` and `public/README.md`.

## 4. Route / island map

n/a — no route is added, moved or re-guarded. `/login` (`pages/login/`, under the guest-only
`auth-shell`) is the destination it always was.

## 5. State management map

| Surface             | Server state                                              | Client state                                                                                                          | URL state | Form state |
| ------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| Sign-out (any path) | the query cache — cleared on `pagehide`, no longer before | `useAuthStore`, `useOrganizationStore`, `useOnboardingStore` — cleared on `pagehide`; onboarding's saved copy at once | —         | —          |
| The login boot      | —                                                         | a module-level promise for the revoke in flight (`pendingRevoke`, `shared/auth/service.ts`)                           | —         | —          |

No new store; nothing server-shaped goes into Zustand.

## 6. Per-surface build notes

### 6.1 Leave without repainting (SO-1)

`src/shared/auth/service.ts`:

- `forceLogout()` (`service.ts:127`) and `handleCrossTabLogout()` (`:140`) called
  `clearLocalAuthState()` — the stores, the org context, the onboarding wizard and
  `queryClient.clear()` — **before** `window.location.href = '/login'`. React repainted the app in the
  next microtask, and the browser painted it before the new document arrived: the account menu
  emptied, gated rooms vanished, every mounted query dropped to pending and refetched without a
  token (401 → refresh → …).
- Split by what the screen shows. `endSessionOffScreen()` — at once: supersede the work in flight
  (the generation), cancel the refresh timer, clear the token and the session hint, clear the
  onboarding store's **saved** copy (`persist.clearStorage()`, PII). `leaveForLogin()` — register
  `clearLocalAuthState` on `pagehide` (`once`), a `pageshow` handler that reloads a `persisted`
  restore, skip the next splash (§6.3), then `location.href = '/login'`.
- `handleCrossTabLogout()`: a tab already on `/login` clears at once (no load follows); any other
  page leaves like `forceLogout()`.
- The full page load stays (D2).

### 6.2 The login screen does not wait (SO-2)

- `startAuthBootstrap()` (`service.ts:166–172`) awaited `finishPendingRevoke()` — a refresh, then a
  revoke — before the guest-only guard could let `/login` render. Every deliberate sign-out writes
  the marker first and its keepalive answer is almost never observed, so **every** sign-out paid
  this: one round trip at best, 5s + 600ms + 5s offline.
- Now the boot throws "Signed out" at once and keeps the revoke in `pendingRevoke`;
  `settlePendingRevoke()` resolves when it has finished (never rejects).
- `shared/api/auth-api.ts` `authFetch` — the one door for `login`, `emailLogin`, `mfaVerify`,
  `oauthStart`, `oauthCallback` — awaits it first, so the old session's refresh answer (which sets
  the refresh cookie) always lands before a new sign-in's.

### 6.3 No splash on the load after a sign-out (SO-3)

- `src/lib/app-splash.ts`: `APP_SPLASH_SKIP` (`'app-splash-skip'` — the key and the class),
  `skipAppSplashOnNextLoad()` (sessionStorage, guarded), `isAppSplashSkipped()`;
  `framesRemainingMs()` returns 0 when skipped; `runExit()` uses the 80ms fallback (as reduced
  motion), since nothing visible fades.
- `public/splash-init.js`: read the key, remove it (one load), add the class to `<html>`.
- `index.html`: load it after `locale-init.js`, before the splash; `.app-splash-skip #app-splash {
visibility: hidden; pointer-events: none }` and `.app-splash-skip #app-splash ~ #root { opacity:
1; transition: none }` (same specificity as the rule hiding `#root`, placed after it).
- The splash node stays, hidden: `FullPageSpinner` keeps returning `null` while it is active, so no
  React loader paints either. Nothing contentful paints until the login screen renders — browsers
  keep the page being left on screen until then.

### 6.4 Docs (SO-4)

`src/shared/auth/AUTH.OVERVIEW.md` (the order of a sign-out; the boot's revoke behind the login
screen), `docs/reference/security-model.md` (stale PII / grants; unattended session),
`docs/reference/design.md` (splash rules), `public/README.md`.

## 7. Deviations

### 7.1 BRIEF over the design

| Item                      | Design says                             | Built as                                                             |
| ------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| The splash after sign-out | shown on every app load (`splash.md:3`) | skipped on the one load a sign-out hands the tab to (`BRIEF.md`, D4) |

### 7.2 Project rules over the source

n/a — no token, component, copy or icon is involved.

### 7.3 The Baseline's Standing deviations this change touches

| Item        | Design says              | Built as (launch)                                  | Since                  | This iteration                                                                                          |
| ----------- | ------------------------ | -------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Sign-out    | "Signed out" card        | the platform `/login`                              | launch-2026-09-30-jxmr | **kept** — and now reached directly, with no splash (out of scope to change: `BRIEF.md` › Out of scope) |
| Splash exit | fixed 3,700ms into Leads | when boot resolves (≥ 2,050ms), into the role home | launch-2026-09-30-jxmr | **kept** for every load but the one after a sign-out (new deviation, §7.1)                              |

## 8. Verification

By Intake mode `brief`: the `BRIEF.md` acceptance criteria, and the baseline set they touch.

- **Unit (Vitest)**: `service.test.ts` (screen kept until `pagehide`, then cleared; saved onboarding
  gone at once; splash skip requested; back/forward-cache restore reloads; cross-tab on another page
  vs on `/login`), `service.pending-revoke.test.ts` (the boot settles before the revoke answers; a
  waiter waits for it; the existing outcomes after it settles), `auth-api.test.ts` (a sign-in is not
  sent until the revoke has finished), `app-splash.test.ts` (a skipped load leaves within frames;
  holds still hold; drift between `app-splash.ts`, `public/splash-init.js` and `index.html`).
- **E2E (Playwright, Chromium) against a local clinozy-be**: a new
  `tests/e2e/sign-out.e2e.test.ts` — the app's DOM is unchanged at `pagehide`; the `/login` load has
  no visible splash and no full-page loader; the login form shows while `/auth/refresh` is held; a
  reload of `/login` plays the splash again — plus the existing sign-out specs
  (`cross-tab-logout`, `journeys`, `routes-integration`, `session-timeout`, `consent-card`,
  `boot-splash`, `home`).
- **Static gates**: `pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure &&
pnpm validate:testids && pnpm type-check && pnpm lint`, plus `pnpm biome:check`, `pnpm
validate:public`, `pnpm docs:lint`, `pnpm sync:check`, `pnpm tsdoc:check`, `pnpm build && pnpm
build:check`.
- **Close**: `AS-BUILT.md` with its Standing deviations, `pnpm iteration:status <iteration> done`;
  `frozen` in the last commit before the merge, after the user's confirmation (D8).

## 9. The route — the ordered ledger

| #    | Work item                                                                                                                            | Kind       | Depends on  | Skill/driver                                                 | Acceptance                                                                                     | Assignee | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ----------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | -------- | ------ |
| SO-1 | Leave without repainting (§6.1): `endSessionOffScreen`, `leaveForLogin`, `pagehide` / `pageshow`, cross-tab on `/login` vs elsewhere | global     | —           | fe-routing-tenancy · fe-test-generation                      | BRIEF acceptance 1, 5, 6; `service.test.ts`                                                    | Claude   | done   |
| SO-2 | The login screen does not wait (§6.2): the boot's revoke behind it, `settlePendingRevoke`, sign-ins wait in `authFetch`              | global     | —           | fe-http-forms-errors · fe-test-generation                    | BRIEF acceptance 3, 4; `service.pending-revoke.test.ts`, `auth-api.test.ts`                    | Claude   | done   |
| SO-3 | No splash on the load after a sign-out (§6.3): `app-splash.ts`, `public/splash-init.js`, `index.html`, public-assets registration    | structural | SO-1        | fe-bundle-performance · fe-pwa-manifest · fe-test-generation | BRIEF acceptance 2, 7; `app-splash.test.ts` incl. drift; `pnpm validate:public`; `build:check` | Claude   | done   |
| SO-4 | Docs (§6.4)                                                                                                                          | gate       | SO-1 – SO-3 | fe-documentation-maintenance                                 | `pnpm docs:lint`; `pnpm sync:check`                                                            | Claude   | done   |
| SO-5 | E2E: `tests/e2e/sign-out.e2e.test.ts` and the existing sign-out specs against a local clinozy-be (§8)                                | verify     | SO-1 – SO-3 | fe-playwright-e2e                                            | every BRIEF acceptance criterion observed in Chromium                                          | Claude   | done   |
| SO-6 | Verify and close: static gates, the unit suite, `AS-BUILT.md` summary + Standing deviations, status `done`                           | verify     | SO-1 – SO-5 | fe-kickoff-iteration › Close                                 | every gate in §8 green                                                                         | Claude   | done   |
