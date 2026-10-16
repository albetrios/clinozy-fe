# KICKOFF — fix-prescription-css-budget-2026-10-16-nfos

> The plan and the ordered ledger for a small `fix` iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field         | Value                                                                                   |
| ------------- | --------------------------------------------------------------------------------------- |
| Iteration     | `fix-prescription-css-budget-2026-10-16-nfos`                                           |
| Mode          | initial — from scratch                                                                  |
| Baseline      | `none` ([D2](plans/decisions.md))                                                       |
| Intake mode   | brief — `BRIEF.md` alone, the whole snapshot                                            |
| Intake hash   | `e897dbe012f1` (gate passed 2026-10-16)                                                 |
| Schema-routes | — (no entity or route changes)                                                          |
| Sources       | `intake-files/BRIEF.md`; CI "Build verify" on albetrios/clinozy-fe#88; the code         |
| Date          | 2026-10-16                                                                              |
| Plans with    | `fe-iteration-planning`; builds with `fe-kickoff-iteration` and `fe-bundle-performance` |
| Sibling       | none                                                                                    |

## 2. Locked decisions

1. **D1** — Get albetrios/clinozy-fe#88 green and merge it.
2. **D2** — A `fix` iteration: the seven it corrects are frozen.
3. **D3** — The 36 kB budget stays.
4. **D4** — The drawer's own sizes move to `prescription-drawer.css`, loaded with the drawer.
5. **D5** — The stepper's touch size moves to `items-field.css`, keyed on `data-touch-size`.
6. **D6** — Colours and spacing reuse shipped utilities and the theme's destructive tokens.
7. **D7** — `motion-reduce:transition-none` is dropped (the global block covers it).
8. **D8** — Approved on the user's instruction.

## 3. Foundation

No token, shell, store or icon change. Two co-located stylesheets, plain and unlayered, written
with the theme's variables (`--spacing`, `--text-sm`, `--color-*`), like `bug-report.css`.

## 4. Route / island map

No route change.

| Unit                                                                                                    | Kind        | Change                                                            |
| ------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| `…/PrescriptionDrawer/prescription-drawer.css` (new)                                                    | stylesheet  | the drawer's tracks, segment and touch sizes, Pad heights, indent |
| `…/PrescriptionDrawer/PrescriptionDrawer.tsx`                                                           | unit file   | imports the stylesheet                                            |
| `…/PrescriptionDrawer/rx-item-cells.tsx`, `rx-medicines-field.tsx`, `rx-medicine-cell.tsx`              | unit files  | the stylesheet's classes in place of the new utilities            |
| `…/PrescriptionDrawer/rx-sidekick.tsx`, `rx-row-allergy.tsx`, `rx-pad-panel.tsx`, `rx-allergy-band.tsx` | unit files  | the stylesheet's classes; shipped colours and spacing             |
| `src/shared/forms/ItemsField/items-field.css` (new), `items-field-cells.tsx`                            | shared unit | the stepper's touch size keyed on `data-touch-size`               |
| `src/shared/components/CommandPalette/CommandPalette.tsx`                                               | shared unit | the prescribe chip: `pe-1`, `hover:bg-background`, flex centring  |

## 5. Verification

The built first-paint stylesheet diffed rule by rule against `main`'s; the drawer's stylesheet not
linked from `index.html`; the colocated tests; the line measured in the running app at 1440 with a
mouse and at 1024 on touch; CI "Build verify" on the PR.

## 6. The route — the ordered ledger

| #   | Work item                                        | Kind    | Depends on | Skill/driver           | Acceptance                 | Assignee | Status             |
| --- | ------------------------------------------------ | ------- | ---------- | ---------------------- | -------------------------- | -------- | ------------------ |
| L-1 | The drawer's stylesheet and its classes          | styling | —          | fe-bundle-performance  | no new rule against `main` | Claude   | done → AS-BUILT #1 |
| L-2 | The stepper's touch size in `items-field.css`    | styling | —          | fe-bundle-performance  | no new rule against `main` | Claude   | done → AS-BUILT #2 |
| L-3 | Shipped utilities for colours, spacing, the chip | styling | —          | fe-bundle-performance  | no new rule against `main` | Claude   | done → AS-BUILT #3 |
| L-4 | Tests that pin the classes                       | verify  | L-1..L-3   | fe-test-generation     | suites pass                | Claude   | done → AS-BUILT #4 |
| L-5 | Verify: the CSS diff, 1440 mouse, 1024 touch     | verify  | L-4        | fe-kickoff-iteration   | §5                         | Claude   | done → AS-BUILT #5 |
| L-6 | Close: AS-BUILT, `done`, `frozen`; CI green      | gate    | L-5        | fe-before-commit-guard | "Build verify" passes      | Claude   | done → AS-BUILT #6 |
