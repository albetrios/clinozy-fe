# KICKOFF — change-today-command-center-2026-10-15-uffs

> The plan and the ordered ledger for a change from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Iteration         | `change-today-command-center-2026-10-15-uffs`                                        |
| Mode              | initial — from scratch                                                               |
| Baseline          | `none` ([D4](plans/decisions.md))                                                    |
| Intake mode       | brief — `BRIEF.md` alone, the whole snapshot ([D5](plans/decisions.md))              |
| Intake hash       | `91a8a1958554` (gate passed 2026-10-15)                                              |
| Schema-routes     | — (no `schema-routes.md`: no entity or route changes)                                |
| Sources           | `intake-files/BRIEF.md` (the change), the current code of Today and the shared parts |
| Date              | 2026-10-15                                                                           |
| Evidence notation | `BRIEF.md:<line>` in `intake-files/`, `src/…:<line>` in the code                     |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills) |
| Sibling           | none — clinozy-be changes nothing ([D3](plans/decisions.md))                         |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — All four improvements: Needs you now, the journey strip, the floor finder, live cues + shortcuts.
2. **D2** — Type `change`, topic `today-command-center`.
3. **D3** — clinozy-fe only; no clinozy-be sibling.
4. **D4** — Baseline `none`, from scratch.
5. **D5** — Intake mode `brief`.
6. **D6** — Branch `feat/today-command-center`; pushed, no PR until the user confirms.
7. **D7** — Keys that do not clash with the app's: `/`, `[` `]`, `N`, `W`; the app's shortcuts list gains the Today rows.
8. **D8** — The finder reuses `RoomSearchField`, which gains combobox attributes.
9. **D9** — Needs you now lists the member's focus lanes; Owner/Admin every readable lane.
10. **D10** — Today's open bills are read while Checkout has people (same cached query as the panel's).
11. **D11** — Screenshots and a recording against the live demo clinic, published as a review page.
12. **D12** — Approved by the user's answers to the scope round on 2026-10-15.

## 3. Foundation (before any screen)

### 3.1 Theme

No token is added or changed. Urgency speaks in the existing tones: blush (hot), butter (warm),
sky (soon), sage (calm) — `TONE_CLASSES` surfaces, dots and inks; dark mode and every theme axis
follow. The strip's chevrons are `muted-foreground`; the spotlight ring is the lane's `ring`.

### 3.2 Shell

Unchanged. The app's keyboard-shortcuts list (`KeyboardShortcutsDialog`) gains three rows (D7).

### 3.3 Stores

None. The finder's open state, highlighted option and "show more" are component state; the
spotlit card is page state for 2 s.

### 3.4 Icons

None new — `ChevronRight` (the strip, flipped under RTL), `Clock` (alert badges), `Keyboard`,
`Search`, `CircleCheck`/`Check` (the calm line) from `@/shared/icons`.

## 4. Route / island map

No route, island, manifest or registration is added, moved or removed.

| Unit                                                                  | Kind             | Change                                                         |
| --------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------- |
| `today/today.attention.ts`                                            | pure model (new) | items, tiers, ranking, focus filter, the tiles' alerts         |
| `today/today.finder.ts`                                               | pure model (new) | name/phone matching over the floor                             |
| `today/today.flags.ts`                                                | pure model       | timing flags (late, due now, in n min), wait levels, the meter |
| `today/components/NeedsYouNow/`                                       | page unit (new)  | the triage list                                                |
| `today/components/FloorFinder/`                                       | page unit (new)  | the finder (combobox + listbox)                                |
| `today/hooks/useTodayShortcuts/`                                      | page hook (new)  | `/`, `[`, `]`, `N`, `W`                                        |
| `today/components/LaneTiles/`                                         | page unit        | the connected strip, alert badges                              |
| `today/components/LanePanel/`                                         | page unit        | timing flags, wait meter, the spotlight                        |
| `today/components/TodayGreeting/`                                     | page unit        | live dot, finder slot, keyboard button, primary New booking    |
| `today/TodayPage.tsx`                                                 | page             | wiring                                                         |
| `src/shared/components/RoomToolbar/RoomSearchField/`                  | shared unit      | optional combobox attributes (D8)                              |
| `src/shared/components/KeyboardShortcutsDialog/` + `layout.constants` | shared unit      | the three Today rows (D7)                                      |
| `src/locales/*/today.json`, `src/locales/*/layout.json`               | copy             | new keys in all eleven locales                                 |

## 5. State management map

| Surface       | Server state                                  | Client state                             | URL state         | Form state |
| ------------- | --------------------------------------------- | ---------------------------------------- | ----------------- | ---------- |
| Needs you now | the floor + enquiries (existing), bills (D10) | "show more" (`useState`)                 | —                 | —          |
| Journey strip | the floor (existing)                          | —                                        | `?lane=` (as now) | —          |
| Floor finder  | the floor (existing)                          | query, open, highlighted (`useState`)    | picks `?lane=`    | —          |
| Spotlight     | —                                             | `{ cardId, nonce }` for 2 s (`useState`) | —                 | —          |
| Shortcuts     | —                                             | —                                        | `?lane=`          | —          |

Nothing is stored in Zustand; no new query.

## 6. Per-screen build notes

### 6.1 Today — `frontend-design`, `web-design-guidelines`, `fe-e2e-testids`

```text
FROM md — 1440 × 900
┌──────────────────────────────────────────────────────────────────────────────┬──────────────┐
│ Good afternoon, Dhaanyalakshmi   ● 7 in clinic · 2 waiting · 4 arriving · …   │ Work queue   │
│                         [🔍 Find on the floor      /] [⌨] [Walk-in] [■ New booking] │ Mine·Everyone│
│ ┌ Needs you now  3 ───────────────────────────────────────────────────────┐  │              │
│ │ (● Late 12 min)  Rahul Mehta   [Arriving] booked 2:30 PM   [Check in]   │  │              │
│ │ (● Waiting 24)   Ananya Rao    [Waiting]  since 2:18 PM    [Send in]    │  │              │
│ │ (● ₹1,500 to pay) Priya Shah   [Checkout] since 1:00 PM    [Checkout]   │  │              │
│ │                                             Show 2 more                 │  │              │
│ └─────────────────────────────────────────────────────────────────────────┘  │              │
│ [Enquiries 3 ⏱1] › [Arriving 4 ⏱2] › [Waiting 2] › [With doctor 2] › [Treatment 1] › …     │
│ ┌ panel — the selected lane's cards; Arriving: "Late 12 min" · Waiting: the meter ┐       │
└──────────────────────────────────────────────────────────────────────────────┴──────────────┘

BELOW md — 390 × 844
greeting · pulse (live dot) · [finder — full width] · [New booking] [Walk-in]
Needs you now (rows wrap to two lines) · the strip (snap scroll, chevrons) · panel · queue
```

- The finder is a combobox over a listbox: ↑/↓ move, Enter picks, Escape closes then clears;
  `aria-activedescendant` on the field; results announce their count (`role="status"`).
- Needs you now is a `section` with its `h2`; each row a list item; actions are the lane's own
  buttons (same handlers, same gates as the cards).
- The strip stays a `fieldset` of toggle buttons (`aria-pressed`); the chevrons are `aria-hidden`;
  a badge's words reach the tile's accessible name through an `sr-only` span.
- The spotlight scrolls the card into view (`block: 'nearest'`), focuses its name and rings it
  for 2 s; reduced motion skips the smooth scroll.

## 7. Deviations

### 7.1 Brief over the design

From scratch there is no carried-forward spec: the brief is the design. The launch design's Today
(`today.md`: two outline buttons, a wrapping tile grid, flags without timing) is changed where
the brief says so — New booking primary, one connected strip, timing flags and the meter.

### 7.2 Project rules over the brief

- Semantic tokens only; a named radius step everywhere; `rounded-full` surfaces carry
  `data-slot="pill"`, status dots stay round (`pnpm validate:tokens`, `validate:theme-axis`).
- Logical CSS only (`pnpm validate:logical`); the chevrons flip under RTL.
- No digits in names (`fe-no-digits-in-names.mdc`): thresholds are named constants.

## 8. Verification

By Intake mode `brief`: the `BRIEF.md` acceptance criteria, each with its proof.

| Criterion (`BRIEF.md`)                      | Proof                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| ranked list with actions (`:85–86`)         | `today.attention` tests (tiers, order); `NeedsYouNow` tests (rows, action, more); screenshots  |
| calm line (`:87`)                           | `NeedsYouNow` test; integration test                                                           |
| focus filter (`:88`)                        | `today.attention` tests (front desk vs owner)                                                  |
| connected strip, badges (`:89–90`)          | `LaneTiles` tests (connectors, badge words); screenshots 1440 + 390                            |
| finder (`:91–92`)                           | `today.finder` tests; `FloorFinder` tests (keyboard, no match); integration test (spotlight)   |
| timing flags, meter (`:93`)                 | `today.flags` tests; `LanePanel` tests                                                         |
| shortcuts (`:94–95`)                        | `useTodayShortcuts` tests (keys, field, modifier, dialog); `KeyboardShortcutsDialog` test      |
| light/dark, sizes, Arabic, flows (`:96–97`) | screenshots (1440 · 1280 · 390, light + dark, `ar`); recording; existing suites; `pnpm health` |

## 9. The route — the ordered ledger

| #    | Work item                                                                                            | Kind       | Depends on | Skill/driver                                  | Acceptance                                   | Assignee | Status |
| ---- | ---------------------------------------------------------------------------------------------------- | ---------- | ---------- | --------------------------------------------- | -------------------------------------------- | -------- | ------ |
| L-1  | Pure models: `today.attention.ts`, `today.finder.ts`, timing flags + wait levels in `today.flags.ts` | logic      | —          | fe-test-generation                            | §8 rows 1, 3, 5, 6 (unit)                    | Claude   | done   |
| L-2  | `NeedsYouNow` (rows, tiers, actions, more/less, calm)                                                | structural | L-1        | frontend-design · web-design-guidelines       | §8 rows 1–2                                  | Claude   | done   |
| L-3  | The journey strip: connectors, one row, alert badges                                                 | structural | L-1        | frontend-design · fe-rtl-logical-css          | §8 row 4                                     | Claude   | done   |
| L-4  | `RoomSearchField` combobox attributes; `FloorFinder`; the spotlight in `LanePanel`                   | structural | L-1        | composition-patterns · web-design-guidelines  | §8 row 5                                     | Claude   | done   |
| L-5  | Live cues: timing flags, wait meter, live dot, primary New booking                                   | styling    | L-1        | frontend-design                               | §8 row 6                                     | Claude   | done   |
| L-6  | Shortcuts: `useTodayShortcuts`, keyboard button, the shortcuts list's Today rows                     | behaviour  | L-4        | fe-resilient-interactions                     | §8 row 7                                     | Claude   | done   |
| L-7  | Copy: `today` and `layout` keys in all eleven locales                                                | copy       | L-2–L-6    | fe-i18n-constants                             | `pnpm validate:i18n`, `validate:i18n-parity` | Claude   | done   |
| L-8  | Wire `TodayPage`; integration test                                                                   | structural | L-2–L-7    | fe-test-generation                            | `today-room` suite                           | Claude   | done   |
| L-9  | Docs: `TODAY.OVERVIEW.md`, the test-id inventory, the project tree                                   | copy       | L-8        | fe-documentation-maintenance · fe-e2e-testids | `pnpm sync:check`, `pnpm docs:lint`          | Claude   | done   |
| L-10 | Verify in the running app: screenshots + recording                                                   | verify     | L-8        | fe-kickoff-iteration                          | §8 last row                                  | Claude   | done   |
| L-11 | Gates: `pnpm health`                                                                                 | gate       | L-9        | fe-before-commit-guard                        | all phases green                             | Claude   | done   |
| L-12 | Close: `AS-BUILT.md`, Status `done` → `frozen`                                                       | verify     | L-10, L-11 | fe-kickoff-iteration                          | README Status `frozen`                       | Claude   | done   |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                                | In plan at     |
| ---------------------- | ----------- | ---------- | ------------------------------------------------- | -------------- |
| `BRIEF.md`             | yes         | the change | four changes, rules, eight criteria, out of scope | §2, §6, §8, §9 |

## Appendix B — Reconciliation (BRIEF ↔ code)

| #   | Fact            | Brief says                    | Code before says                                                   | Winner | Action   |
| --- | --------------- | ----------------------------- | ------------------------------------------------------------------ | ------ | -------- |
| R1  | urgency         | a ranked list across lanes    | one lane at a time; a long wait is a butter "Waiting n min" pill   | brief  | L-1, L-2 |
| R2  | the tiles       | one connected row with badges | an `auto-fill` grid that wraps from `md`, a snap strip below it    | brief  | L-3      |
| R3  | finding someone | a finder over the floor       | none — the header's ⌘K searches every contact, not who is in today | brief  | L-4      |
| R4  | arriving cards  | Late / Due now / In n min     | Confirmed / Unconfirmed only                                       | brief  | L-5      |
| R5  | the buttons     | New booking primary           | two outline buttons (`today.md:18`)                                | brief  | L-5      |
| R6  | keys            | `/` `[` `]` `N` `W`           | the app's `?`, `G`, digits, ⌘K; rooms' `/`                         | code   | D7       |
| R7  | bills read      | "₹n to pay" in the list       | read only while Checkout is the open lane                          | brief  | D10      |
