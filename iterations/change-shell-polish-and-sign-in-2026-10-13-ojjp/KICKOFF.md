# KICKOFF — change-shell-polish-and-sign-in-2026-10-13-ojjp

> The plan and the ordered ledger for a small, incremental iteration from a written brief
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Iteration         | `change-shell-polish-and-sign-in-2026-10-13-ojjp`                                                                           |
| Mode              | incremental                                                                                                                 |
| Baseline          | `launch-2026-09-30-jxmr` ([D2](plans/decisions.md))                                                                         |
| Intake mode       | brief — `BRIEF.md` received, 22 files carried forward from the Baseline                                                     |
| Intake hash       | `bc5d68b3628f` (gate passed 2026-10-13, Baseline `036cbb592ac5` unchanged)                                                  |
| Schema-routes     | `5f90325208e1` — unchanged from the Baseline                                                                                |
| Sources           | `intake-files/BRIEF.md` (the change), the carried-forward specs it touches, the current code                                |
| Date              | 2026-10-13                                                                                                                  |
| Evidence notation | `BRIEF.md:<line>`, `<spec>.md:<line>` in `intake-files/`, `src/…:<line>` in the code today                                  |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills)                                        |
| Sibling           | clinozy-be's same-named iteration — backend contract unchanged ([D15](plans/decisions.md)); `BRIEF.md` byte-identical there |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — The user delegated the iteration end to end: plan both repositories, take the recommended answer at every question, approve, build and close; no PR until the user confirms.
2. **D2** — Baseline `launch-2026-09-30-jxmr` (the only iteration with an intake; none is `done` or `frozen` yet).
3. **D3** — Intake mode `brief`: the change arrived as words, not design files.
4. **D4** — Built on the session branch `claude/determined-rubin-c9i935` in both repositories, not `change/shell-polish-and-sign-in`.
5. **D5** — Room switches keep the 280ms rise; a flush room's frame clips vertical overflow **only while the rise plays**.
6. **D6** — Tabs keep their weights (600 current, 500 others — `shell.md:40`, `shell.md:48`); every tab that switches weight reserves its 600 width.
7. **D7** — Picked badges: a 1.5px edge in a new `tone-<t>-edge` colour (the tone's ink mixed with its dot) and a 3px halo in the dot at 22%; hover previews a 1px edge. Replaces the design's ink ring.
8. **D8** — The edge's ink share is 45% in light and 15% in dark; stone mixes `foreground-soft` 55% with `border-strong`. Every edge ≥ 3:1 against the page and the chip (§3.1).
9. **D9** — Sign-in concept "A calm clinic day": hero · card · showcase; from `lg` side by side, below `lg` stacked hero → card → showcase.
10. **D10** — The new frame is `AuthLayout`'s (sign-in, MFA, the sign-in hand-off); the other public pages keep `PublicFrame` as is.
11. **D11** — Marketing copy is product truth from `PRD.md:9` and `PRD.md:214`; no numbers, customers, testimonials or named people.
12. **D12** — Picked cards (Appearance tiles, the billing plan card) and quick-fill chips are not badges: unchanged.
13. **D13** — New strings ship in all 11 locales; the 10 translations are the agent's and are flagged for a native read (AMBER).
14. **D14** — Approved by delegation (D1) on 2026-10-13.

## 3. Foundation (before any screen)

### 3.1 Theme — one derived token per tone (no new preset)

No preset is added or changed, so the four preset registration points (`[data-theme]` blocks, the
swatch, `THEME_PRESETS`, `PRESET_PRIMARY`) are **n/a**. One token family is added, derived from each
tone's own ink and dot so light, dark, every `data-base` and every preset follow it:

```text
@theme inline (src/index.css — the block for tokens that point at other tokens)
  --color-tone-<t>-edge: color-mix(in oklab, var(--color-tone-<t>-foreground) var(--tone-edge-ink), var(--color-tone-<t>-dot))
        for t ∈ butter · lav · sky · sage · blush · mint · peach · plum · lime · slate
  --color-tone-stone-edge: color-mix(in oklab, var(--color-foreground-soft) 55%, var(--color-border-strong))

:root  { --tone-edge-ink: 45%; }      light: a mid shade of the tone, never near-black
.dark  { --tone-edge-ink: 15%; }      dark: mostly the dot, never near-white
```

Contrast, **recomputed locally** (OKLab mix → linear sRGB → WCAG ratio; script kept in the session):

| Tone   | Light: edge vs card · vs chip | Old ink vs chip | Dark: edge vs card · vs chip |
| ------ | ----------------------------- | --------------- | ---------------------------- |
| butter | 4.40 · 3.63                   | 8.45            | 8.15 · 7.19                  |
| lav    | 5.22 · 4.14                   | 8.54            | 6.69 · 5.76                  |
| sky    | 4.96 · 4.01                   | 8.29            | 7.00 · 5.95                  |
| sage   | 5.07 · 4.13                   | 8.19            | 6.72 · 5.68                  |
| blush  | 5.21 · 4.11                   | 8.29            | 6.58 · 5.67                  |
| mint   | 4.86 · 4.02                   | 8.25            | 7.12 · 6.11                  |
| peach  | 4.52 · 3.63                   | 7.68            | 7.49 · 6.55                  |
| plum   | 5.22 · 4.12                   | 8.33            | 6.57 · 5.67                  |
| lime   | 4.41 · 3.68                   | 8.18            | 7.96 · 6.96                  |
| slate  | 5.28 · 4.24                   | 8.36            | 6.47 · 5.53                  |
| stone  | 4.02 · 3.69                   | 9.53            | 5.44 · 4.59                  |

Every edge clears WCAG 1.4.11's 3:1 for a state indicator; the old ink line was 2–3× stronger than
anything else on a pastel chip, which is why it read as a black border.

`TONE_CLASSES` (`src/shared/app/app-tones.ts`) changes in one place:

| Key                 | Before                            | After                                                                     |
| ------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| `ring`              | `ring-1 ring-tone-<t>-foreground` | `ring-1 ring-tone-<t>-edge`                                               |
| `selected` NEW      | —                                 | `inset-ring-[1.5px] inset-ring-tone-<t>-edge ring-3 ring-tone-<t>-dot/22` |
| `selectedHover` NEW | —                                 | `hover:inset-ring hover:inset-ring-tone-<t>-edge`                         |

### 3.2 Shell

No new shell variant: two in-place changes to `AppLayoutSectionBar` / `AppLayout.shared.tsx`
(the scroll frame, the tab labels). The surface-relocation table is **n/a** — no platform surface
moves. The sign-in frame is `AuthLayout`'s, not the clinic shell's.

### 3.3 Stores

n/a — nothing new is stored; the showcase is static and reduced motion is a media query.

### 3.4 Icons

n/a — every icon the showcase draws is already exported by `@/shared/icons/index.ts`: `UserPlus`,
`Calendar`, `Clock`, `Stethoscope`, `Sparkles`, `Wallet`, `SquareCheck`, `House`, `Phone`, `Receipt`,
`Users`, `Bell`, `Palette`, `Lock`.

## 4. Route / island map

No route, island, manifest or registration is added, moved or removed.

| Unit                                                         | Kind                          | Change                                    |
| ------------------------------------------------------------ | ----------------------------- | ----------------------------------------- |
| `/login`, `/mfa`, `/callback` (`pages/login`, …) — public    | page (in the `auth-shell`)    | unchanged; framed by the new `AuthLayout` |
| `src/shared/layouts/AuthLayout/AuthLayout.tsx`               | layout                        | the split frame                           |
| `src/shared/layouts/AuthLayout/components/AuthShowcase/` NEW | layout unit (folder-per-unit) | hero + showcase                           |
| `src/shared/components/WeightStableLabel/` NEW               | shared unit                   | a label that keeps its 600 width          |
| `src/shared/layouts/AppLayout/…` (org-scoped shell)          | layout                        | frame clip; tab labels                    |

## 5. State management map

| Surface          | Server state | Client state                                             | URL state | Form state                       |
| ---------------- | ------------ | -------------------------------------------------------- | --------- | -------------------------------- |
| Room frame clip  | —            | — (a `data-replaying` attribute the animation hook owns) | —         | —                                |
| Tab labels       | —            | —                                                        | —         | —                                |
| Picked badges    | —            | —                                                        | —         | — (unchanged owners)             |
| Sign-in showcase | —            | —                                                        | —         | — (the card's form is untouched) |

No rule is under pressure: nothing new is stored anywhere.

## 6. Per-screen build notes

### 6.1 Room switch without a flicker (shell, every room) — `fe-resilient-interactions`, `fe-test-generation`

Cause, measured in the running app (1440 × 900, Leads → Patients → Leads): `<main>`'s
`scrollHeight − clientHeight` went 6 → 4 → 3 → 2 → 1 → 0 px over ~140ms after the switch.

```text
BEFORE — a flush room fills <main> exactly; the rise pushes it 6px past the bottom

  t = 0ms          t = 70ms          t = 140ms         t = 280ms
  ┌─ main ──────┐  ┌─ main ──────┐█  ┌─ main ──────┐▌  ┌─ main ──────┐
  │ room  ↓6px  │  │ room  ↓3px  │█  │ room  ↓1px  │▌  │ room        │   █ ▌ = a scrollbar that
  │             │  │             │█  │             │▌  │             │       appears, shrinks and
  └─────────────┘  └─────────────┘█  └─────────────┘▌  └─────────────┘       vanishes; the room's
     overflow 6       overflow 3        overflow 1        overflow 0          width jumps with it

AFTER — the room frame clips vertically only while the rise plays

  replay starts ──► data-replaying on the page ──► frame: overflow-y clip
  every Animation.finished settles ──► attribute removed ──► frame: overflow visible again
  no animation (reduced motion, none running) ──► the attribute is never left behind
```

- `useReplayedAnimation` (`src/lib/animations/useReplayedAnimation.ts:31`) marks the element
  `data-replaying` from the replay until every animation on it settles (`getAnimations()` →
  `finished`, cancellation included) and clears it on cleanup; a replay that starts before the last
  one finished keeps the attribute.
- `AppMain`'s flush frame (`AppLayout.shared.tsx:348`) adds
  `has-[>[data-replaying]]:overflow-y-clip`; `overflow-x` stays visible (focus rings, shadows) and
  `clip` keeps `position: sticky` working (no new scroll container).
- The rise itself is unchanged: `route-rise`, 280ms, `cubic-bezier(0.22, 1, 0.36, 1)`,
  `translateY(6px) → 0` (`src/index.css:314`).
- A room taller than a short viewport still scrolls `<main>` — the clip lasts 280ms, not forever (D5).

### 6.2 Tabs keep their place — `composition-patterns`, `fe-test-generation`

Cause, measured: Appointments 128.0 → 129.6px when current; every later tab shifts 1.5px; phone
labels re-centre by 0.3–1.2px. The design asks 600 for current and 500 for the rest (`shell.md:40`,
`shell.md:48`), and the header's fold already budgets every tab at 600
(`fit-pinned-tabs.ts` — "a label's width at the tabs' 600 13px").

```text
BEFORE                                         AFTER — each label is two layers in one grid cell
 [▣ Appointments][Leads][Patients][Payments]    ┌──────────────────────┐
  ←—— 600: 129.6px ——→                          │ Appointments  ← shown, at the state's weight (500 or 600)
 [▣ Appointments][Leads]…                       │ Appointments  ← invisible, always 600, height 0,
  ←—— 500: 128.0px ——→   every tab after it      └──────────────────────┘    text from a data attribute
                         moves 1.6px                 width = the 600 width, whatever the state
```

- New `WeightStableLabel` (`src/shared/components/WeightStableLabel/`): `inline-grid`; the shown
  label truncates; the reserve is an `aria-hidden` sibling whose `::before` prints `data-label` at
  `font-semibold`, `invisible`, height 0 — no second text node, so `getByText` and screen readers
  see the label once.
- Users: the header's pinned tabs (`PinnedTabs.tsx:59–66`), the phone tab bar's labels and its
  "More" label (`AppLayout.shared.tsx:120`, `:171`), and `RoomViewTabs`' two looks that switch weight —
  `card` (the composer's "Send via", `ChatComposer.tsx:184`) and `plain` (the patient file bar,
  `PatientFileBar.tsx:101`) (`RoomTabs.tsx:303–312`). The `track` look and `RoomTabs` keep one weight
  and are untouched.

### 6.3 Soft picked badges — `frontend-design`, `fe-theme-axis-audit`, `fe-test-generation`

```text
              BEFORE (design: "selected = 1.5px ring in its ink")      AFTER
 unpicked     ( Follow-up )  tone fill, ink text                      ( Follow-up )  unchanged
 hover        ( Follow-up )  + ink edge                               ( Follow-up )  + 1px tone edge
 picked      ((█Follow-up█)) 1px ink border + 1px ink ring = 2px     ░( Follow-up )░ 1.5px tone edge (inset)
                             near-black (light) / near-white (dark)    + 3px halo in the dot at 22%
 untoned      ((█  Any   █)) ink of `foreground` — pure black        ░(   Any    )░ stone edge + stone halo
```

| Surface (owner)                                                                                                                             | Before                                                              | After                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| `DrawerChips` tone (`drawer-chip-controls.tsx:109–114`) — drawers, Filters, Appearance chips                                                | picked `border-current ring-1 ring-current`; hover `border-current` | `selected`; hover `selectedHover`; untoned → stone |
| `DrawerChips` button (`:103–107`)                                                                                                           | picked `border-current`                                             | `border-transparent` + `selected`                  |
| `DrawerChips` outline (`:98–101`)                                                                                                           | picked `border-foreground`                                          | `border-transparent` + stone `selected`            |
| Number chips (`drawer-number-controls.tsx:156`)                                                                                             | picked `border-foreground`                                          | stone `selected`                                   |
| New-lead presets (`NewLeadContactStep.tsx:120`)                                                                                             | picked `border-foreground`                                          | stone `selected`                                   |
| Today lane tiles (`LaneTiles.tsx:104–105`, `today.lanes.ts:69`)                                                                             | pressed border = lane ink; hover = ink                              | pressed border = lane edge + halo; hover = edge    |
| Reason chips (`confirm-reasons.ts:113–118`)                                                                                                 | checked 1.5px ink ring; hover ink ring                              | checked edge + halo; hover 1px edge                |
| Feedback types (`FeedbackCard.tsx:178–179`)                                                                                                 | on: ink ring 1.5px / `ring-foreground`                              | `selected` (tone or stone)                         |
| Colour swatches (`drawer-choice-controls.tsx:73–74`)                                                                                        | picked `ring-current` 1.5px                                         | `ring` (edge) 1.5px; hover `selectedHover`         |
| Slot chips hover (`DateTimeStep.tsx:292`)                                                                                                   | hover `ring-current`                                                | `selectedHover`                                    |
| Picked avatars (`PersonAvatar.tsx:191`), section tiles (`PatientSectionsPopover.tsx:86`), fresh clinical chips (`ClinicalChipCard.tsx:118`) | `ring` = ink                                                        | `ring` = edge (the key's new value)                |

Timings: chips keep `transition-[color,box-shadow] 150ms`; lane tiles keep 0ms (`today.md:191`).

### 6.4 The sign-in screen — `frontend-design`, `fe-i18n-constants`, `fe-e2e-testids`, `web-design-guidelines`

**Wireframes.**

```text
FROM lg (≥ 1024px) — 1440 × 900
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [C] clinozy                                                        [English ⌄] [☼]       │ 60px header (unchanged:
├──────────────────────────────────────────────────────────────────────────────────────────┤  the logo never moves)
│   ╭─ showcase canvas · rounded-3xl · tonal wash (lav ↖ sky ↗ peach ↘ sage ↙) ─╮            │
│   │  (● For skin, hair & aesthetic clinics)                                    │ ╭───────╮ │
│   │  Your whole clinic,                                                        │ │Welcome│ │
│   │  calm in one place.                         ← h2, display size             │ │back   │ │
│   │  Enquiries become appointments, appointments become patients …             │ │[email]│ │
│   │  ╭─ One patient, one thread ──────────────────────────── ● live ─╮         │ │[Cont.]│ │
│   │  │ (Enquiry)─(Booked)─(Waiting)─(With doctor)─(Treatment)─        │         │ ╰───────╯ │
│   │  │ (Checkout)─(Follow-up)        a wave lights each stop in turn  │         │ 🔒 Private│
│   │  ╰─────────────────────────────────────────────────────────────────╯         │ by design│
│   │  ╭ Checked in ╮  ╭ Follow-up set ╮  ╭ Invoice settled ╮   moments, floating │           │
│   │  ◆ Every room in step   ◆ Nothing slips through   ◆ Calm by design          │           │
│   ╰────────────────────────────────────────────────────────────────────────────╯           │
└──────────────────────────────────────────────────────────────────────────────────────────┘
  grid: minmax(0,1.25fr) | minmax(22.5rem,1fr) · gap 40px · max-width 72rem · centred

BELOW lg — 390 × 844 (and 375 × 667: the card's button stays above the fold)
┌──────────────────────────────┐
│ [C] clinozy      [EN ⌄] [☼]  │ 52px
│ (● For skin, hair & aesth…)  │ hero: eyebrow, headline (2 lines), one line
│ Your whole clinic,           │
│ calm in one place.           │
│ ╭──────────────────────────╮ │
│ │ Welcome back · [email]   │ │ the card — unchanged
│ │ [Continue]               │ │
│ ╰──────────────────────────╯ │
│ 🔒 Private by design …       │
│ ╭ One patient, one thread ─╮ │ showcase: the stops wrap,
│ │ (Enquiry)(Booked)(Wait…) │ │ moments stack,
│ ╰──────────────────────────╯ │ values list
└──────────────────────────────┘
  DOM order hero → card → showcase (the tab order reaches the email field second only to
  the header's controls; the hero is not interactive)
```

**Copy** (English; every string an `auth` key under `showcase.*`, all 11 locales — D13):

| Key                          | English                                                                                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eyebrow`                    | For skin, hair & aesthetic clinics                                                                                                                                                  |
| `headline`                   | Your whole clinic, calm in one place.                                                                                                                                               |
| `lead`                       | Enquiries become appointments, appointments become patients, and every visit flows into notes, treatments and payments — no more WhatsApp threads, paper registers or spreadsheets. |
| `journey.title`              | One patient, one thread                                                                                                                                                             |
| `journey.live`               | Live                                                                                                                                                                                |
| `journey.label`              | A patient's journey through Clinozy                                                                                                                                                 |
| `journey.stops.*`            | Enquiry · Booked · Waiting · With doctor · Treatment · Checkout · Follow-up                                                                                                         |
| `moments.label`              | Moments from a clinic day                                                                                                                                                           |
| `moments.checkIn` / `…Meta`  | Checked in at the front desk · Today · just now                                                                                                                                     |
| `moments.followUp` / `…Meta` | Follow-up call set for Tuesday · Tasks                                                                                                                                              |
| `moments.invoice` / `…Meta`  | Invoice settled at checkout · Payments                                                                                                                                              |
| `values.label`               | Why clinics switch to Clinozy                                                                                                                                                       |
| `values.inStep.*`            | Every room in step — Front desk, doctors, therapists, the pharmacy and accounts work from one live record.                                                                          |
| `values.nothingSlips.*`      | Nothing slips through — Follow-ups, dues and low-stock medicines come to you before anyone has to remember them.                                                                    |
| `values.calm.*`              | Calm by design — Colour-coded rooms your team reads at a glance, even on the busiest day.                                                                                           |
| `privacy`                    | Private by design — each clinic sees only its own records.                                                                                                                          |

**Journey stops** — tone and icon per stop (the rooms' own tones, `app-tones.ts` `SECTION_TONES` and
the Today lanes): Enquiry lav `UserPlus` · Booked sky `Calendar` · Waiting butter `Clock` · With doctor
blush `Stethoscope` · Treatment sage `Sparkles` · Checkout peach `Wallet` · Follow-up plum `SquareCheck`.

**Motion** (all `motion-reduce:animate-none`; reduced motion shows every stop lit and nothing moving):

| Name           | What                                                            | Duration                   | Delay             | Easing      |
| -------------- | --------------------------------------------------------------- | -------------------------- | ----------------- | ----------- |
| `journey-wave` | a stop dims to 45%, lights to 100% with a 2px lift, holds, dims | 8400ms, infinite           | stop _i_ × 600ms  | ease-in-out |
| `float`        | a moment card drifts 4px up and back                            | 6000ms, infinite alternate | 0 · 1200 · 2400ms | ease-in-out |
| `pulse-dot`    | the "Live" and eyebrow dots breathe (halo 18% → 32%)            | 2400ms, infinite           | 0                 | ease-in-out |
| card entry     | unchanged — `AuthForm`'s `animate-fade-in-up`                   | 280ms                      | 0                 | as today    |

**States.** The card's own states (loading, error, MFA, OAuth hand-off) are untouched. The showcase
has one state; a section error boundary is not needed — it is static markup.

**Test ids** (new): `auth-showcase`, `auth-showcase-hero`, `auth-showcase-journey`,
`auth-showcase-moments`, `auth-showcase-values`. Existing ids (`auth-layout`, `auth-form-container`,
`public-frame-controls`, every login id) are kept.

## 7. Deviations

### 7.1 Brief over the carried-forward specs

| Item               | Design says (evidence)                                                                                                                         | Built as (this iteration)            | Decision |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------- |
| Picked chips       | "selected adds a 1px ink ring" (`preset.md:64`); "selected = 1.5px ring in its ink" (`_patterns.md:61`, `_patterns.md:113`, `patients.md:133`) | 1.5px tone edge + 3px dot halo       | D7       |
| Selected lane tile | "border 1.5px (selected: lane ink …)" (`today.md:32`)                                                                                          | 1.5px lane edge + halo               | D7       |
| Sign-in surface    | the design's only sign-in surface is the "Signed out" card (`shell.md:60`, `_index.md:20`)                                                     | split screen: hero · card · showcase | D9       |

### 7.2 Project rules over the source

- The edge is a derived token in `@theme inline`, never a literal colour (`pnpm validate:tokens`).
- Every showcase string is an i18n key in all 11 locales; Indian-English product truth only (D11).
- The hero headline is an `h2`; the card's heading stays the page's `h1`.

### 7.3 The Baseline's Standing deviations this change touches

| Item                | Design says              | Built as (Baseline)                                                          | This iteration                                    |
| ------------------- | ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| Sign-out            | "Signed out" card        | the platform `/login` — a card on the signed-out canvas (`PublicFrame`)      | **changed**: the card beside the sign-in showcase |
| New task drawer     | the 720px composer …     | the shared record drawer: the drawer chips (picked = an ink edge and ring) … | **changed**: picked = the tone edge and halo      |
| Phone tab bar       | the app grid's third row | fixed `MobileNav`                                                            | kept                                              |
| Tab-bar slot radius | 10px                     | `rounded-lg`                                                                 | kept                                              |

## 8. Verification

By Intake mode `brief`: the `BRIEF.md` acceptance criteria, each with its proof, plus the baseline set.

| Criterion (`BRIEF.md`)                               | Proof                                                                                                                                                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| no scrollbar during the rise (`:68–69`)              | the frame-sampling script in the running app: `main` overflow 0 on every frame, 1440 × 900 and 390 × 844, by pinned tab, phone tab, All sections, shortcut; unit tests on the hook and the frame class                 |
| the rise still plays; not under a drawer (`:70`)     | `PageTransition` tests (existing + `data-replaying`)                                                                                                                                                                   |
| no tab moves (`:71–72`)                              | the sampling script: every tab's left edge and the search width identical before/after; `WeightStableLabel` tests                                                                                                      |
| phone labels keep width (`:73`)                      | the sampling script at 390 × 844                                                                                                                                                                                       |
| weight-switching rows keep width (`:74`)             | `RoomTabs` test: the `card` and `plain` looks render the reserve                                                                                                                                                       |
| no ink edge on picked badges (`:75–77`)              | `app-tones` tests (no `-foreground` in `ring` / `selected`), owner tests, screenshots light + dark                                                                                                                     |
| state announced, edge ≥ 3:1 (`:78–79`)               | existing `aria-*` assertions; §3.1 table                                                                                                                                                                               |
| sign-in layout and order (`:80–81`)                  | screenshots 1440 · 1024 · 390 · 375 × 667, light + dark; `AuthLayout` test for the DOM order                                                                                                                           |
| strings in all locales; flow tests unchanged (`:82`) | `pnpm validate:i18n && pnpm validate:i18n-parity`; the login suites pass unchanged                                                                                                                                     |
| reduced motion (`:83`)                               | screenshot with `prefers-reduced-motion: reduce` + the class assertion                                                                                                                                                 |
| gates and budgets (`:84`)                            | `pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure && pnpm validate:testids && pnpm type-check && pnpm lint && pnpm biome:check && pnpm test && pnpm build && pnpm build:check && pnpm size` |

Baseline set: the shell and every room render as before apart from the picked edges (spot screenshots of
Today, Leads + Filters, a record drawer, the patient file); the existing unit suites stay green.
Close: `AS-BUILT.md` with its summary and Standing deviations, `pnpm iteration:status <it> done`;
`frozen` waits for the last commit before the merge (the user confirms the PRs first — D1).

## 9. The route — the ordered ledger

| #    | Work item                                                                                                                    | Kind       | Depends on | Skill/driver                                             | Acceptance                                                                               | Assignee | Status |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- | ------ |
| L-1  | Tone edge tokens (`@theme inline`, `--tone-edge-ink`) + `TONE_CLASSES` `ring` / `selected` / `selectedHover`                 | foundation | —          | fe-theme-axis-audit                                      | tokens resolve light + dark; `app-tones` tests; `validate:tokens`, `validate:theme-axis` | Claude   | open   |
| L-2  | Room frame clips while the rise plays (`useReplayedAnimation` `data-replaying`, `AppMain` frame)                             | global     | —          | fe-resilient-interactions · fe-test-generation           | §8 row 1–2; hook + frame tests                                                           | Claude   | open   |
| L-3  | `WeightStableLabel` shared unit                                                                                              | global     | —          | composition-patterns · fe-test-generation                | unit test: one text node, reserve at 600, truncation                                     | Claude   | open   |
| L-4  | Header pinned tabs + phone tab bar labels use it                                                                             | styling    | L-3        | fe-design-ditto                                          | §8 row 3–4 (sampling script)                                                             | Claude   | open   |
| L-5  | `RoomViewTabs` `card` and `plain` looks use it                                                                               | styling    | L-3        | fe-design-ditto                                          | §8 row 5                                                                                 | Claude   | open   |
| L-6  | Picked chips: `DrawerChips` (tone · button · outline), number chips, new-lead presets                                        | styling    | L-1        | frontend-design                                          | §8 row 6; owner tests                                                                    | Claude   | open   |
| L-7  | Picked badges elsewhere: lane tiles, reason chips, feedback types, swatches, slot hover; `ring` users                        | styling    | L-1        | frontend-design                                          | §8 row 6–7; screenshots                                                                  | Claude   | open   |
| L-8  | Sign-in copy: `auth` `showcase.*` keys, 11 locales                                                                           | copy       | —          | fe-i18n-constants                                        | `validate:i18n`, `validate:i18n-parity`                                                  | Claude   | open   |
| L-9  | Sign-in showcase + split `AuthLayout` (hero · card · showcase, motion, reduced motion, test ids)                             | structural | L-1, L-8   | frontend-design · fe-e2e-testids · web-design-guidelines | §8 rows 8–10; `AuthShowcase` + `AuthLayout` tests                                        | Claude   | open   |
| L-10 | Docs: the shell, sign-in and badge notes (`LOGIN.OVERVIEW.md`, layout/overview docs that describe the ink edge or the frame) | copy       | L-1–L-9    | fe-documentation-maintenance                             | `pnpm sync:check`, `pnpm docs:lint`                                                      | Claude   | open   |
| L-11 | Verify: the BRIEF acceptance in the running app (scripts + screenshots, light/dark, 375–1440)                                | verify     | L-1–L-10   | fe-kickoff-iteration                                     | every §8 row proven                                                                      | Claude   | open   |
| L-12 | Gates: static, unit, build, size                                                                                             | gate       | L-11       | fe-before-commit-guard                                   | §8 last row green                                                                        | Claude   | open   |
| L-13 | Close: `AS-BUILT.md` (rows, summary, Standing deviations), Status `done`                                                     | verify     | L-12       | fe-kickoff-iteration                                     | README Status `done`                                                                     | Claude   | open   |

## Appendix A — Coverage matrix

| File (`intake-files/`)                                                                     | Read fully?                                                                          | Kind                   | Facts it owns here                                                  | In plan at       |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------- | ---------------- |
| `BRIEF.md`                                                                                 | yes                                                                                  | the change             | four changes, rules, 11 criteria, out of scope                      | §2, §6, §8, §9   |
| `shell.md`                                                                                 | the rows it touches (`:7–60`)                                                        | spec (carried forward) | tab weights `:40`, `:48`; pinned tabs `:21`; signed-out `:60`       | §6.2, §7.1       |
| `_patterns.md`                                                                             | the rows it touches (`:61`, `:113`, motion `:325–346`)                               | spec (carried forward) | picked chip ring; no page-enter motion in the design                | §6.1, §6.3, §7.1 |
| `preset.md`                                                                                | the tone rule (`:64`), motion (`:223–224`)                                           | spec (carried forward) | chips' ink ring                                                     | §3.1, §7.1       |
| `today.md`                                                                                 | lane tiles (`:19–32`, `:191`, `:205`)                                                | spec (carried forward) | selected tile border, 0ms hover                                     | §6.3             |
| `patients.md`                                                                              | Filters (`:133`)                                                                     | spec (carried forward) | picked chip ring                                                    | §6.3, §7.1       |
| `_index.md`, `PRD.md`                                                                      | `_index.md:20`; `PRD.md:9`, `:213–214`                                               | index / product        | the only sign-in surface; product truth and adjectives for the copy | §6.4, D11        |
| the other 15 files (screens, prototype, `support.js`, `schema-routes.md`, `_report.md`, …) | not re-read — unchanged since the Baseline (`iteration:diff`: only `BRIEF.md` added) | carried forward        | none in this change                                                 | —                |

## Appendix B — Reconciliation (BRIEF ↔ carried-forward specs ↔ code)

| #   | Fact                       | Brief / spec says                                                                                                | Code today says                                                                                                          | Winner | Action                              |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------- |
| R1  | page entry motion          | the rise stays (`BRIEF.md:5–9`); the design names no page-enter motion (`_patterns.md:325–346`)                  | `route-rise` 280ms on `PageTransition` (`index.css:314`, `PageTransition.tsx:59`)                                        | brief  | keep the rise, clip the frame (L-2) |
| R2  | tab weight                 | 600 current, 500 others (`shell.md:40`, `:48`); no movement (`BRIEF.md:10–14`)                                   | weight swap with no reserve (`PinnedTabs.tsx:59–61`, `AppLayout.shared.tsx:120`, `RoomTabs.tsx:303–312`)                 | both   | keep weights, reserve 600 (L-3–L-5) |
| R3  | fold budget                | —                                                                                                                | the fold measures at 600 (`PinnedTabs.tsx:19–21`)                                                                        | code   | matches the reserve: no change      |
| R4  | picked chip edge           | ink ring (`preset.md:64`, `_patterns.md:61`, `:113`, `patients.md:133`) vs soft same-hue edge (`BRIEF.md:15–21`) | ink via `ring-current` / `border-current` / `*-foreground` (§6.3 table)                                                  | brief  | L-1, L-6, L-7                       |
| R5  | lane tile selected         | lane ink (`today.md:32`) vs soft edge (`BRIEF.md:15–17`)                                                         | `border-tone-<t>-foreground` (`today.lanes.ts:69`)                                                                       | brief  | L-7                                 |
| R6  | sign-in surface            | "Signed out" card (`shell.md:60`) vs hero · card · showcase (`BRIEF.md:22–34`)                                   | `AuthLayout` → `PublicFrame` + `PublicCard` (`AuthLayout.tsx:17–25`)                                                     | brief  | L-8, L-9                            |
| R7  | other public pages         | out of scope (`BRIEF.md:90–91`)                                                                                  | `PublicFrame` (`OrganizationPickerPage`, onboarding, invitations)                                                        | brief  | untouched (D10)                     |
| R8  | four rebuild-forcing facts | popup shape · mobile behaviour · step sequence · table-vs-card                                                   | the sign-in card keeps its own; the showcase has none of the four; phone order hero → card → showcase (`BRIEF.md:33–34`) | brief  | §6.4                                |
