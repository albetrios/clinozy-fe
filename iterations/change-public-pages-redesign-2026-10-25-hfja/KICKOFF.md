# KICKOFF — change-public-pages-redesign-2026-10-25-hfja

> The plan and the ordered ledger for an iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change. The build came before this record (D2): the plan below is
> the one the build followed, in the order of its eight commits.

## 1. Header

| Field             | Value                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Iteration         | `change-public-pages-redesign-2026-10-25-hfja`                                       |
| Mode              | initial — from scratch                                                               |
| Baseline          | `none` ([D3](plans/decisions.md))                                                    |
| Intake mode       | brief — `BRIEF.md` alone, the whole snapshot ([D3](plans/decisions.md))              |
| Intake hash       | `4a8be576d0ef` (gate passed 2026-10-25)                                              |
| Schema-routes     | — (no `schema-routes.md`: no entity or route changes)                                |
| Sources           | `intake-files/BRIEF.md` (the change), the user's answers in the session, the code    |
| Date              | 2026-10-25                                                                           |
| Evidence notation | `BRIEF.md:<section>` in `intake-files/`, `src/…` in the code, commits by short hash  |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills) |
| Sibling           | none — clinozy-be changes nothing ([D15](plans/decisions.md))                        |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — One iteration for everything on the branch since `main`, frozen before the PR.
2. **D2** — The build came first; this file records the plan it followed.
3. **D3** — Baseline `none`, Intake mode `brief`.
4. **D4** — A calm product glimpse: the Today sheet replaces the journey dial.
5. **D5** — A living tour on the viewer's local time, every feature shown working, phone too.
6. **D6** — No loading screen for a signed-out visitor; Google's code exchanged at boot.
7. **D7** — One loader everywhere: the wordmark's turning "o".
8. **D8** — v2 approved; "Email", not "Work email".
9. **D9** — The device remembers the current branch's hours, hours only.
10. **D10** — "Tomorrow" snoozes wake at the task's branch's next opening.
11. **D11** — Branch holidays are not read.
12. **D12** — An eighth slide, Branches: a deck that fans and folds into "All branches".
13. **D13** — Short, two-beat headlines; "Every patient. Every branch. One calm screen."
14. **D14** — The login visual shots pin the tour's clock; the Linux PNGs stay as on `main`.
15. **D15** — No clinozy-be sibling.
16. **D16** — Approved; finished work is recorded and frozen before its PR from now on.

## 3. Foundation (before any screen)

### 3.1 Theme

No token is added. The tour uses the room tones (`tone-<t>` and its ink, dot, edge and border),
the neutrals and the logo's green (`brand-mark`) through semantic classes or `var(--color-…)`; dark
mode, every preset and every theme axis follow. One glyph, the wordmark's "o", becomes the brand's
loader and its status emblem.

### 3.2 Shell

`AuthLayout` (the `auth-shell` route's frame) is rebuilt as two columns; `AppLayout` gains one hook,
`useRememberBranchHours`. `public/splash-init.js` and `index.html` skip the splash for a
signed-out visit and draw the sign-in layout's outline as the first paint.

### 3.3 Stores

None new. The device's branch hours are one `localStorage` key, `clinozy:branch-hours` (hours only),
beside the session hint — never a store, never authority.

### 3.4 Icons

None new (`Building` for the Branches slide is in the registry).

## 4. Route / island map

No route, island, manifest or registration is added, moved or removed.

| Unit                                                          | Kind                        | Change                                                              |
| ------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| `/login`, `/mfa`, `/callback` — public                        | pages (in the `auth-shell`) | framed by the new `AuthLayout`; copy; Google's code at boot         |
| `src/shared/layouts/AuthLayout/` + `components/AuthShowcase/` | layout + its units          | the two columns; the tour (engine, sheet, lenses, branch deck)      |
| `src/shared/components/ui/spinner.tsx`, `BrandLoader`         | shared ui                   | the one loader                                                      |
| `src/app/errors/` (404, 403, global boundary)                 | app shell                   | the "o" emblem and copy                                             |
| `src/shared/app/branch-hours.ts`, `hooks/useBranchHours/`     | shared                      | branch hours, the device's memory, the current branch's hours       |
| Tasks room, Today's work queue                                | page islands                | the "Tomorrow" snooze from the task's branch (`useTaskSnoozeWords`) |

## 5. State management map

| Surface                   | Server state                       | Client state                                        | URL state | Form state |
| ------------------------- | ---------------------------------- | --------------------------------------------------- | --------- | ---------- |
| The tour                  | —                                  | `useTour` (chapter, holds, run); the viewer's clock | —         | —          |
| The device's branch hours | `GET /app/branches/my` (read)      | `localStorage` `clinozy:branch-hours` (a hint)      | —         | —          |
| The "Tomorrow" snooze     | `POST /app/tasks/{task_id}/snooze` | —                                                   | —         | —          |

No rule is under pressure: no API data is stored in Zustand, and the device keeps hours only.

## 6. Per-screen build notes

### 6.1 The first paint and Google's return — `fe-platform-hygiene`, `fe-routing-tenancy`

A signed-out `/` or `/login` gets no splash (`splash-init.js` reads the session hint before the app
loads) and the boot frame draws the two-column outline; Google's `code` is exchanged at boot.

### 6.2 One loader — `frontend-design`, `shadcn`

`<Spinner />` (`data-slot="spinner"`, 900ms; 2.4s under reduced motion, never still) in every busy
state; `Button isLoading` keeps its colour and label; `BrandLoader` turns the wordmark's own "o";
ESLint rejects `animate-spin` in app code.

### 6.3 The sign-in screen and the tour — `frontend-design`, `web-design-guidelines`, `review-animations`

```text
FROM 68.75rem — 1440 × 900
┌──────────────────────────────┬───────────────────────────────────────────────┐
│ [C] clinozy    [EN ⌄] [☼]    │  ● For skin, hair & aesthetic clinics          │
│                              │  Every patient. Every branch.                  │
│  Sign in to Clinozy          │  One calm screen.                              │
│  [Continue with Google]      │  ━━ ━━ ━━ ── ── ── ── ──  [❚❚]                 │
│  ── or use your email ──     │  ● Leads  5:22 PM: a DM becomes a lead         │
│  [Email               ]      │  ┌ Today · Saturday, October 24     ● Live ┐  │
│  [Continue with email ]      │  │ 5:00 PM  Kabir Shah          With doctor │  │
│  🔒 Private by design         │  │ 5:30 PM  Riya — her row, in the slide's tone│
│                              │  │   ╰ the lens: the feature at work        │  │
│ © 2026 Clinozy  Privacy …    │  └──────────────────────────────────────────┘  │
└──────────────────────────────┴───────────────────────────────────────────────┘
BELOW — one column: header → form → stage → footer
```

- Eight slides, 5.2s each (the last rests 2.4s more); plays only on `/login`, holds on pointer,
  typing, a hidden tab or the stage off screen; pause button; only a picked slide is narrated.
- The sheet's day is the viewer's clock in this device's branch hours (`tour-day.ts`); closed, the
  branch's next opening; visits outside the hours are not drawn.
- Branches: the sheet drops and the other branches' sheets fan out above it, then fold at
  `--deck-fold-at`; one animation for the sheet so leaving slides it back up.

### 6.4 The status pages — `frontend-design`

`FallbackState` takes an `emblem` (`missing`, `locked`, `broken`) and a `label` pill inside the one
heading; 404 adds "Go back".

### 6.5 Branch hours — `fe-test-generation`, `fe-i18n-constants`

`DEFAULT_BRANCH_HOURS` (moved from the setup drawer), `nextBranchWorkingDay`, `civilWeekday`;
`useBranchHours` (task's branch → current → defaults) and `useRememberBranchHours` in `AppLayout`; a
`nextOpening` task span; the snooze option worded by the one time rule.

## 7. Deviations

### 7.1 Brief over the design

From scratch there is no carried-forward spec: the brief and the approved prototype (v2) are the
design. The previous sign-in (`change-sign-in-journey-dial-2026-10-14-etrk`: a split screen and a
journey dial) is replaced, not extended.

### 7.2 Project rules over the brief

- Semantic tokens only; named radius steps; `data-slot="pill"` on round surfaces; logical CSS.
- The tour's grid and motion ship as co-located stylesheets with the lazy auth chunk.
- The branch names and the patients are fictional sample data, not copy.

## 8. Verification

By Intake mode `brief`: the `BRIEF.md` acceptance criteria, each with its proof.

| Criterion (`BRIEF.md`)                     | Proof                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| no splash signed out; Google at boot       | `boot-splash.e2e` (10 passed); production timing 2.7s → 0.43s, exchange 464 → 295ms             |
| one loader                                 | `spinner`, `button`, `BrandLoader` tests; ESLint rule; screenshots                              |
| two columns from 1100px                    | `AuthLayout` tests (order, grid); screenshots 390–1920                                          |
| the tour: plays, holds, pauses, narrates   | `AuthShowcase` tests (timing, holds, pause, reduced motion, narration, every scene, replay)     |
| viewer's clock, branch hours, next opening | `tour-day` tests; `AuthShowcase` tests (tomorrow, Monday, a remembered branch, last slots)      |
| the Branches deck                          | `AuthShowcase` tests (states, picker, fan only in motion, replay, exit); measured drop and exit |
| headlines, 11 locales, title breaks        | tests on the headlines; screenshots `en`, `de`, `es`, `ar` at 1440 and 390                      |
| status pages                               | `NotFoundPage`, `UnauthorizedPage`, `ErrorBoundary` tests; routes-integration e2e               |
| "Tomorrow" snooze                          | `tasks-contracts`, `useTaskSnoozeWords`, `useTaskActions`, `useWorkQueue` tests                 |
| light, dark, Arabic, 390–1920, no overflow | screenshots; overflow measured 0 at each width                                                  |
| budgets, SonarQube                         | `pnpm size` (Initial JS 241.84 / 250 kB, CSS 35.71 / 36.2 kB); the pre-push SonarQube gate (0)  |

## 9. The route — the ordered ledger

| #    | Work item                                                                                  | Kind       | Depends on | Skill/driver                                                | Acceptance                   | Assignee | Status |
| ---- | ------------------------------------------------------------------------------------------ | ---------- | ---------- | ----------------------------------------------------------- | ---------------------------- | -------- | ------ |
| L-1  | No splash for a signed-out visit; Google's code at boot (`b6e019b`)                        | global     | —          | fe-platform-hygiene · fe-routing-tenancy                    | §8 row 1                     | Claude   | done   |
| L-2  | One loader everywhere (`48aada9`)                                                          | global     | —          | frontend-design · shadcn                                    | §8 row 2                     | Claude   | done   |
| L-3  | The sign-in screen and the tour, copy in 11 locales, the first paint's outline (`f19b8fa`) | structural | L-1, L-2   | frontend-design · web-design-guidelines · review-animations | §8 rows 3–5                  | Claude   | done   |
| L-4  | The status pages' emblem and copy (`7a19009`)                                              | styling    | L-2        | frontend-design                                             | §8 row 8                     | Claude   | done   |
| L-5  | SonarQube's findings on the tour (`15497d0`)                                               | verify     | L-3        | fe-code-quality-security                                    | §8 last row                  | Claude   | done   |
| L-6  | Branch hours: the device's memory, the tour's day, the "Tomorrow" snooze (`d09f0fc`)       | structural | L-3        | fe-test-generation · fe-i18n-constants                      | §8 rows 5, 9                 | Claude   | done   |
| L-7  | The Branches slide (`7979c33`)                                                             | structural | L-6        | frontend-design · review-animations                         | §8 row 6                     | Claude   | done   |
| L-8  | The headlines and the title's breaks (`67567a1`)                                           | copy       | L-7        | fe-i18n-constants                                           | §8 row 7                     | Claude   | done   |
| L-9  | The login visual shots pin the tour's clock (D14)                                          | verify     | L-8        | fe-visual-regression                                        | the shots stable on a re-run | Claude   | done   |
| L-10 | Verify: the BRIEF criteria in the running app; gates; e2e against the live backend         | verify     | L-1–L-9    | fe-kickoff-iteration                                        | every §8 row proven          | Claude   | done   |
| L-11 | Close: `AS-BUILT.md` (rows, summary, Standing deviations), Status `done`, then `frozen`    | verify     | L-10       | fe-kickoff-iteration                                        | README Status `frozen`       | Claude   | done   |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                                 | In plan at     |
| ---------------------- | ----------- | ---------- | -------------------------------------------------- | -------------- |
| `BRIEF.md`             | yes         | the change | five changes, rules, eleven criteria, out of scope | §2, §6, §8, §9 |

## Appendix B — Reconciliation (BRIEF ↔ code)

| #   | Fact              | Brief says                              | Code before says                                          | Winner | Action     |
| --- | ----------------- | --------------------------------------- | --------------------------------------------------------- | ------ | ---------- |
| R1  | the first visit   | no splash signed out (§ What changes 1) | the splash on every cold load                             | brief  | L-1        |
| R2  | busy states       | one loader (2)                          | Lucide `Loader2`, three tempos, hand-rolled rings         | brief  | L-2        |
| R3  | the sign-in stage | a tour of one patient's day (3)         | a split screen with a journey dial                        | brief  | L-3, L-7   |
| R4  | status pages      | the "o" emblem (4)                      | an empty-state illustration                               | brief  | L-4        |
| R5  | clinic hours      | the branch's (5)                        | 08:00–21:00 every day in the tour; 10:00 for every snooze | brief  | L-6        |
| R6  | branch holidays   | out of scope                            | read by the Branches room only                            | brief  | none (D11) |
