# KICKOFF — change-sign-in-journey-dial-2026-10-14-etrk

> The plan and the ordered ledger for a small iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change. The build came before this record (D5): the plan below is
> the one the build followed.

## 1. Header

| Field             | Value                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Iteration         | `change-sign-in-journey-dial-2026-10-14-etrk`                                        |
| Mode              | initial — from scratch                                                               |
| Baseline          | `none` ([D2](plans/decisions.md))                                                    |
| Intake mode       | brief — `BRIEF.md` alone, the whole snapshot ([D3](plans/decisions.md))              |
| Intake hash       | `a30ce422a023` (gate passed 2026-10-14)                                              |
| Schema-routes     | — (no `schema-routes.md`: no entity or route changes)                                |
| Sources           | `intake-files/BRIEF.md` (the change), the current code of the parts it affects       |
| Date              | 2026-10-14                                                                           |
| Evidence notation | `BRIEF.md:<line>` in `intake-files/`, `src/…:<line>` in the code                     |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills) |
| Sibling           | none — clinozy-be changes nothing ([D13](plans/decisions.md))                        |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — This iteration records the sign-in redesign only, in the same PR as the redesign.
2. **D2** — Baseline `none`, from scratch; the process now starts every iteration from scratch unless the user names a Baseline.
3. **D3** — Intake mode `brief`; from scratch the brief stands alone.
4. **D4** — Built on `feat/login-screen-redesign`; one PR.
5. **D5** — The build came first; this file records the plan it followed.
6. **D6** — A split screen from `xl`: the stage and the form in a full-height panel at the inline end; one column below.
7. **D7** — The journey dial replaces the pill row; one 15.4s turn, 2.2s a stop; moments lift on their stop.
8. **D8** — No new copy: the existing `auth` › `showcase.*` keys.
9. **D9** — The split and the dial ship as lazy CSS with the auth chunk; the initial CSS stays within budget.
10. **D10** — `PublicCardHeader` `size="display"` for the sign-in, code-step and MFA headings.
11. **D11** — The `/login` visual baselines are recorded by the user with clinozy-be running.
12. **D12** — Pushed without the pre-push hook (SonarQube needs Docker); every other step run by hand.
13. **D13** — No clinozy-be sibling.
14. **D14** — Approved by the user on 2026-10-14.

## 3. Foundation (before any screen)

### 3.1 Theme

No token is added or changed. The dial uses the seven room tones (`tone-<t>` dot, `tone-<t>`
surface, `tone-<t>-foreground` ink), the zinc neutrals and the logo's green (`brand`), all through
semantic classes or `var(--color-…)`; dark mode, every preset and every theme axis follow.

### 3.2 Shell

`AuthLayout` (the `auth-shell` route's frame) is rebuilt; the app shell and `PublicLayout` are
untouched. Two `PublicFrame` parts are extracted so `AuthLayout` can place them in its own grid:
`PublicSkipLink` and `PublicPrivacyChoices` — `PublicFrame` keeps rendering them as before.

### 3.3 Stores

None.

### 3.4 Icons

None new — the stops keep their room icons from `@/shared/icons`.

## 4. Route / island map

No route, island, manifest or registration is added, moved or removed.

| Unit                                                                  | Kind                          | Change                                                       |
| --------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------ |
| `/login`, `/mfa`, `/callback` — public                                | pages (in the `auth-shell`)   | unchanged; framed by the new `AuthLayout`                    |
| `src/shared/layouts/AuthLayout/AuthLayout.tsx` + `auth-layout.css`    | layout                        | the split frame                                              |
| `src/shared/layouts/AuthLayout/components/AuthShowcase/`              | layout unit (folder-per-unit) | hero, dial, moments, reasons, backdrop, privacy line         |
| `src/shared/components/PublicFrame/`                                  | shared unit                   | `PublicSkipLink`, `PublicPrivacyChoices`; header `size` prop |
| `src/shared/forms/…/AuthWelcomeHeader`, `src/pages/mfa/forms/MfaForm` | form headings                 | `size="display"`                                             |

## 5. State management map

| Surface          | Server state | Client state | URL state | Form state                |
| ---------------- | ------------ | ------------ | --------- | ------------------------- |
| The split frame  | —            | —            | —         | — (the form is untouched) |
| The journey dial | —            | — (CSS only) | —         | —                         |

No rule is under pressure: nothing is stored anywhere. The dial's motion is pure CSS — one clock,
no JavaScript timer.

## 6. Per-screen build notes

### 6.1 The sign-in frame — `frontend-design`, `web-design-guidelines`, `fe-e2e-testids`

```text
FROM xl (≥ 1280px) — 1440 × 900
┌──────────────────────────────────────────────────────────────┬─────────────────────────┐
│ [C] clinozy                                                   │        [English ⌄] [☼]  │
│                                                               │                         │
│  (● For skin, hair & aesthetic clinics)       ╭── dial ──╮    │          [C]            │
│  Your whole clinic,                          ╱  ● Enquiry ╲   │   Welcome back          │
│  calm in one place.                         │ ●   Booked  ●│  │   [email            ]   │
│  Enquiries become appointments, …           │  WAITING    ●│  │   [Continue         ]   │
│  ─────────────────────────────              │ ● One patient│  │   ─── or ───            │
│  ◆ Every room in step                        ╲ ●  ● ●    ╱    │   [Google] [GitHub]     │
│  ─────────────────────────────                ╰─────────╯     │                         │
│  ◆ Nothing slips through          [Checked in] [Invoice] …    │   🔒 Private by design   │
│  ◆ Calm by design                                             │      Privacy choices    │
└──────────────────────────────────────────────────────────────┴─────────────────────────┘
  grid: minmax(0,1fr) | auto (dial) | var(--auth-panel) · rows 1fr auto auto 1fr
  panel 26rem · 28rem from 2xl · 32rem from 3xl · full height · border-inline-start

BELOW xl — 390 × 844
┌──────────────────────────────┐
│ [C] clinozy      [EN ⌄] [☼]  │
│ hero (start-aligned)         │
│ ╭ Welcome back ────────────╮ │  the 360px card — above the fold
│ │ [email] [Continue]       │ │
│ ╰──────────────────────────╯ │
│ 🔒 Private by design          │
│ the dial                     │
│ the moments (stacked)        │
│ the reasons                  │
│ Privacy choices              │
└──────────────────────────────┘
```

- DOM order hero → form → dial → reasons, so the keyboard reaches the email field after the skip
  link and the hero; the form heading stays the page's `h1`, the hero headline an `h2`.
- Logical placement only (`inset-inline-*`, `border-inline-start`, `ps-`/`pe-`): RTL mirrors.
- At `xl` the card's own chrome (border, radius, shadow, background) falls away — the panel is the
  surface.

### 6.2 The journey dial — `frontend-design`, `review-animations`

- Three SVG rings (track, dotted bezel, the centre disc); seven stops placed on the ring by
  `--x` / `--y` per `data-stop`, clockwise from the top (`BRIEF.md:18–22`).
- One clock: `--dial-turn: 15.4s`, `--dial-step: 2.2s`; every stop's lift, halo, centre label and
  moment card runs the same turn, delayed `calc(var(--stop) * var(--dial-step))`
  (`BRIEF.md:23–25`).
- The thread is a rotated arm holding the green dot; under RTL the rotation runs the other way and
  the aura mirrors.
- Page load: the dial turns in from −12° out of a blur, the stops pop in 60ms apart, the hero's
  lines, the reasons and the moment cards rise in turn (`BRIEF.md:26–27`).
- Reduced motion: the dial stands still, every stop named; the thread, the halos and the cycling
  centre label are hidden (`BRIEF.md:60–61`).
- Only `transform`, `opacity` and a short `filter: blur` animate; a stop's label is never dimmed
  (`BRIEF.md:62`).

### 6.3 The moments and the reasons — `frontend-design`

The three moment cards float by the dial from `sm`, stacked under it on a phone, each tied to its
stop (`checkIn` → Waiting, `invoice` → Checkout, `followUp` → Follow-up) and lifting with a ring in
its tone when the thread reaches it (`BRIEF.md:28–30`). The reasons become a list with hairline
rules (`BRIEF.md:31–32`).

## 7. Deviations

### 7.1 Brief over the design

From scratch there is no carried-forward spec: the brief is the design. The code's previous
sign-in (the `change-shell-polish-and-sign-in-2026-10-13-ojjp` showcase: a washed panel beside the
card, a row of journey pills) is replaced, not extended.

### 7.2 Project rules over the brief

- Semantic tokens only; a named radius step everywhere; `rounded-full` surfaces carry
  `data-slot="pill"` (`pnpm validate:tokens`, `pnpm validate:theme-axis`).
- Logical CSS only (`pnpm validate:logical`).
- The split's grid and the dial live in co-located stylesheets imported by the lazy layout (D9),
  so the first paint stays within `pnpm size`.

## 8. Verification

By Intake mode `brief`: the `BRIEF.md` acceptance criteria, each with its proof.

| Criterion (`BRIEF.md`)                           | Proof                                                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| split from 1280px; order below it (`:70–71`)     | screenshots 1280 · 1440 · 1920 · 834 · 390, light + dark; `AuthLayout` tests (DOM order, panel from `xl`)                                                     |
| seven stops, 15.4s turn, centre label (`:72–73`) | `AuthShowcase` tests (stops, timing variables in the stylesheet); screenshots settled on a stop                                                               |
| moments lift on their stop (`:74`)               | `AuthShowcase` test (each moment's `--stop` equals its stop's); screenshots                                                                                   |
| Arabic mirrors (`:75`)                           | screenshot `ar` 1440                                                                                                                                          |
| French fits (`:76–77`)                           | screenshot `fr` 1440 (ring labels apart, centre label wrapped)                                                                                                |
| reduced motion (`:78`)                           | screenshot with `prefers-reduced-motion: reduce`; the stylesheet's reduced-motion block                                                                       |
| light + dark, no raw colours (`:79`)             | screenshots; `pnpm validate:tokens`                                                                                                                           |
| flows and test ids unchanged (`:80`)             | the login, verify-code and MFA suites pass unchanged; `pnpm validate:testids`                                                                                 |
| initial CSS within budget (`:81`)                | `pnpm size` Initial CSS                                                                                                                                       |
| gates                                            | `pnpm health` (format, lint, biome, docs, type-check, test, build, size, env, public, tsdoc, knip, tokens, logical, theme-axis, testids, structure, agent-os) |

## 9. The route — the ordered ledger

| #   | Work item                                                                                                  | Kind       | Depends on | Skill/driver                                         | Acceptance                                        | Assignee | Status |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------- | ---------- | ---------------------------------------------------- | ------------------------------------------------- | -------- | ------ |
| L-1 | `PublicFrame` parts: `PublicSkipLink`, `PublicPrivacyChoices`, `PublicCardHeader` `size`                   | global     | —          | composition-patterns · fe-test-generation            | `PublicFrame` tests; other public pages unchanged | Claude   | done   |
| L-2 | The split `AuthLayout` + `auth-layout.css` (stage, panel, one column below `xl`)                           | structural | L-1        | frontend-design · web-design-guidelines              | §8 row 1; `AuthLayout` tests                      | Claude   | done   |
| L-3 | The journey dial, moments, reasons, backdrop + `auth-showcase.css` (motion, RTL, reduced motion, test ids) | structural | L-2        | frontend-design · review-animations · fe-e2e-testids | §8 rows 2–7; `AuthShowcase` tests                 | Claude   | done   |
| L-4 | Display form headings (`AuthWelcomeHeader`, `MfaForm`)                                                     | styling    | L-1        | frontend-design                                      | §8 row 8; `AuthWelcomeHeader` test                | Claude   | done   |
| L-5 | Retire the old journey keyframes from `index.css`                                                          | styling    | L-3        | fe-bundle-performance                                | §8 row 9                                          | Claude   | done   |
| L-6 | Docs: `LOGIN.OVERVIEW.md`, `design.md`, the test-id inventory, the project tree                            | copy       | L-1–L-5    | fe-documentation-maintenance                         | `pnpm sync:check`, `pnpm docs:lint`               | Claude   | done   |
| L-7 | Verify: the BRIEF criteria in the running app (screenshots, light/dark, 390–1920, `ar`, `fr`, reduced)     | verify     | L-1–L-6    | fe-kickoff-iteration                                 | every §8 row proven                               | Claude   | done   |
| L-8 | Gates: `pnpm health`                                                                                       | gate       | L-7        | fe-before-commit-guard                               | §8 last row                                       | Claude   | done   |
| L-9 | Close: `AS-BUILT.md` (rows, summary, Standing deviations), Status `done`                                   | verify     | L-8        | fe-kickoff-iteration                                 | README Status `done`                              | Claude   | done   |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                              | In plan at     |
| ---------------------- | ----------- | ---------- | ----------------------------------------------- | -------------- |
| `BRIEF.md`             | yes         | the change | six changes, rules, nine criteria, out of scope | §2, §6, §8, §9 |

## Appendix B — Reconciliation (BRIEF ↔ code)

| #   | Fact               | Brief says                                                    | Code before says                                                                 | Winner | Action          |
| --- | ------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------ | --------------- |
| R1  | the frame          | split screen from `xl`, form in a full-height panel (`:5–14`) | hero · card · showcase side by side from `lg`, a washed showcase panel           | brief  | L-2             |
| R2  | the journey        | a dial with a stepping thread (`:18–28`)                      | a row of seven pills with a light wave (`journey-wave` keyframes in `index.css`) | brief  | L-3, L-5        |
| R3  | the form heading   | display size (`:33–34`)                                       | `PublicCardHeader` 18px everywhere                                               | brief  | L-1, L-4        |
| R4  | copy               | no new strings (`:55`)                                        | `auth` › `showcase.*` in 11 locales                                              | code   | reused as is    |
| R5  | other public pages | out of scope (`:86–87`)                                       | `PublicFrame` (organization picker, invitation, 404)                             | brief  | untouched (D10) |
