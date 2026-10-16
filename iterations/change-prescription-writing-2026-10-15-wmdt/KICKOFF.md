# KICKOFF — change-prescription-writing-2026-10-15-wmdt

> The plan and the ordered ledger for an iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Iteration         | `change-prescription-writing-2026-10-15-wmdt`                                        |
| Mode              | initial — from scratch                                                               |
| Baseline          | `none` ([D2](plans/decisions.md))                                                    |
| Intake mode       | brief — `BRIEF.md` alone, the whole snapshot                                         |
| Intake hash       | `814cd0f7abbd` (gate passed 2026-10-15)                                              |
| Schema-routes     | — (no `schema-routes.md`: no entity or route changes)                                |
| Sources           | `intake-files/BRIEF.md` (the change), the current code of the parts it affects       |
| Date              | 2026-10-15                                                                           |
| Evidence notation | `BRIEF.md` §n in `intake-files/`, `src/…` in the code                                |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills) |
| Sibling           | none — clinozy-be changes nothing ([D3](plans/decisions.md))                         |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md): what is built (D1), why a new
iteration on the same branch (D2), the line's days (D3), store or outside (D4), the dose taps (D5),
the Days cell (D6), the allergy warning and its save (D7), earlier prescriptions (D8), approval (D9).

## 3. Foundation (before any screen)

- **Theme:** none — semantic tokens and the app's tones (`sage`, `blush`, `slate`, `butter`) only;
  touch sizes through Tailwind's `pointer-coarse:` variant.
- **Shared units:** `ItemsField` gains `rowFooter` (a full-width line under a row's note, a `cell`
  spanning the row) — generic, off by default; every other host is unchanged.
- **Stores:** none — the Keep answers and the earlier-prescription page are component state.
- **Icons:** from `@/shared/icons` only.

## 4. Route / island map

No route changes. Everything is inside
`src/pages/organization/$organizationSlug/patients/$patientId/prescriptions/` (the drawer's
folder, the table hook) and `src/shared/forms/ItemsField/`.

## 5. State management map

| State                            | Owner                                     |
| -------------------------------- | ----------------------------------------- |
| A line's days                    | the drawer's form (`RxFormLine.days`)     |
| The Keep answers                 | `useRxComposer` (per drawer, by name)     |
| The attention after a held save  | `useRxComposer` (a counter the row reads) |
| The earlier prescription on show | `RxSidekick` (an index into the history)  |

## 6. Per-screen build notes

### 6.1 The medicine rows — `frontend-design`, `web-design-guidelines`, `fe-e2e-testids`

Columns: Medicine · Dose · Days · Meal · Where · Qty · ×, then the note, then the row footer.
The Medicine trigger draws the name and its source pill; the list is grouped; its footer switches
store ↔ outside (D4). The Dose cell: three one-tap toggles and the ⌄ menu (D5). Days: the Picker
(D6). Quantity recomputes from days × doses a day on a change of either; it stays editable. On a
coarse pointer the row's own taps and buttons are 36px.

### 6.2 The allergy warning under its row — `frontend-design`, `fe-resilient-interactions`

`rx-row-allergy.tsx` renders in `rowFooter` for a row in the matches: the warning (role `alert`
when it first appears), Remove and Keep; kept, one quiet line. `use-rx-composer.tsx` holds the
answers and the save: unanswered → open Medicines, bump the attention counter, toast; answered →
save. `rx-allergy-confirm.tsx` and its copy are removed (D7).

### 6.3 Earlier prescriptions — `frontend-design`, `web-design-guidelines`

`RxSidekick` gains the section (D8): the pager, the lines (plain words), + Add / "In this Rx",
Add all, the advice. The drawer passes the history without the record being edited.

## 7. Deviations

### 7.1 Brief over the design

None — the brief is the design.

### 7.2 Project rules over the brief

- The Days cell is the shared `Picker`, not a new chip grid (reuse before create, D6).

## 8. Verification

| #   | Criterion (`BRIEF.md` acceptance)                  | Proven by                                                  |
| --- | -------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Source pill per row; grouped list; store ↔ outside | unit tests (drawer) + screenshot 1440                      |
| 2   | Days presets / typed; quantity follows             | `rx-form` units + drawer test + screenshot                 |
| 3   | Days split on open, joined on save                 | `rx-form` units (`rxFormLineOf`, `rxItemOf`)               |
| 4   | Dose toggles; presets; + for two                   | drawer test + screenshot                                   |
| 5   | Touch sizes ≥ 36px                                 | screenshot 390 (touch emulation)                           |
| 6   | Warning under the row; no dialog                   | drawer test + screenshot                                   |
| 7   | Held save opens Medicines, focuses Keep            | drawer test                                                |
| 8   | Earlier prescriptions: pager, Add, Add all         | drawer test + screenshot                                   |
| 9   | Table directions with days                         | table hook test                                            |
| 10  | Copy in 11 locales; gates                          | `pnpm health`, `pnpm sync:check`, the local SonarQube gate |

## 9. The route — the ordered ledger

| #   | Row                                                                                    | Kind       | Depends on | Skills                                                   | Proves                                       | Assignee | Status |
| --- | -------------------------------------------------------------------------------------- | ---------- | ---------- | -------------------------------------------------------- | -------------------------------------------- | -------- | ------ |
| L-1 | The line's `days` (form model, quick line, Pad, plain words, since last, save) + units | structural | —          | fe-test-generation                                       | §8 rows 2–3                                  | Claude   | done   |
| L-2 | `ItemsField` `rowFooter`                                                               | global     | —          | composition-patterns · fe-test-generation                | `ItemsField` tests; other hosts unchanged    | Claude   | done   |
| L-3 | The medicine rows: source pill and list, Dose, Days, touch sizes                       | structural | L-1        | frontend-design · web-design-guidelines · fe-e2e-testids | §8 rows 1, 2, 4, 5                           | Claude   | done   |
| L-4 | The allergy warning under its row; the confirm removed                                 | structural | L-2        | frontend-design · fe-resilient-interactions              | §8 rows 6–7                                  | Claude   | done   |
| L-5 | Earlier prescriptions in the sidekick; the table's days                                | structural | L-1        | frontend-design · web-design-guidelines                  | §8 rows 8–9                                  | Claude   | done   |
| L-6 | Copy in all 11 locales                                                                 | copy       | L-3–L-5    | fe-i18n-constants                                        | `pnpm validate:i18n`, `validate:i18n-parity` | Claude   | done   |
| L-7 | Docs: `PRESCRIPTIONS.OVERVIEW.md`, the test-id inventory, `ItemsField`'s overview      | copy       | L-2–L-6    | fe-documentation-maintenance                             | `pnpm sync:check`, `pnpm docs:lint`          | Claude   | done   |
| L-8 | Verify in the running app (1440 light/dark, 1280, 1024, 390 touch, Arabic; a video)    | verify     | L-1–L-7    | fe-kickoff-iteration                                     | every §8 row proven                          | Claude   | done   |
| L-9 | Gates; close `AS-BUILT.md`, Status `done`                                              | gate       | L-8        | fe-before-commit-guard · fe-kickoff-iteration            | §8 row 10; README Status `done`              | Claude   | done   |
