# KICKOFF — change-prescription-one-click-2026-10-15-jzxk

> The plan and the ordered ledger for an iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field         | Value                                                                                |
| ------------- | ------------------------------------------------------------------------------------ |
| Iteration     | `change-prescription-one-click-2026-10-15-jzxk`                                      |
| Mode          | initial — from scratch                                                               |
| Baseline      | `none` ([D2](plans/decisions.md))                                                    |
| Intake mode   | brief — `BRIEF.md` alone, the whole snapshot                                         |
| Intake hash   | `0a845f8bc51b` (gate passed 2026-10-15)                                              |
| Schema-routes | — (no entity or route changes)                                                       |
| Sources       | `intake-files/BRIEF.md`, the current code of the Medicines step                      |
| Date          | 2026-10-15                                                                           |
| Plans with    | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills) |
| Sibling       | none                                                                                 |

## 2. Locked decisions

[plans/decisions.md](plans/decisions.md): scope (D1), the iteration (D2), where the chips sit (D3),
two tablets (D4), which chips show (D5), days (D6), keyboard and touch (D7), approval (D8).

## 3. Foundation

- **Theme:** tokens and the app's tones only; chips are pills (`rounded-full` with
  `data-slot="pill"`, the theme axis rule).
- **Shared units:** `ItemsField` gains `rowDetail` (a full-width line before a row's note); the icon
  registry gains `Sunrise`.
- **Stores:** none — "+ more" places is component state.

## 4. Route / island map

No route changes — the prescriptions island's drawer and `src/shared/forms/ItemsField/`.

## 5. State management map

| State                            | Owner                             |
| -------------------------------- | --------------------------------- |
| A line's dose, days, when, where | the drawer's form (unchanged)     |
| "+ more" places open             | the row's Where group (component) |

## 6. Per-screen build notes — `frontend-design`, `ui-ux-pro-max`, `web-design-guidelines`

`rx-item-cells.tsx` becomes the chips: a chip, a chip group (label, roving focus), Dose, Days,
When, Where and the line rail. `rx-medicines-field.tsx`: columns Medicine · Dose · Qty, `rowDetail`
the rail, the toolbar the "Same days for all" strip. Pure helpers in `rx-form.ts`: the day chips,
the two timing lists, the top places, `rxIsSkinLine`, `rxDoubledDose`, `withRxDaysForAll`.

## 7. Deviations

None planned.

## 8. Verification

| #   | Criterion                                      | Proven by                                   |
| --- | ---------------------------------------------- | ------------------------------------------- |
| 1   | One click per usual value; second click clears | drawer test + screenshots                   |
| 2   | Chips fit the medicine; unusual values lit     | `rx-form` units + drawer test               |
| 3   | + more in place                                | drawer test + screenshot                    |
| 4   | Same days for all                              | `rx-form` unit + drawer test                |
| 5   | One Tab stop per group; arrows; 44px touch     | drawer test + screenshot 390 (touch)        |
| 6   | Copy, gates                                    | `pnpm health`, `pnpm sync:check`, SonarQube |

## 9. The route — the ordered ledger

| #   | Row                                     | Kind       | Depends on | Skills                                                  | Proves             | Assignee | Status |
| --- | --------------------------------------- | ---------- | ---------- | ------------------------------------------------------- | ------------------ | -------- | ------ |
| L-1 | Pure helpers + units                    | structural | —          | fe-test-generation                                      | §8 rows 2, 4       | Claude   | done   |
| L-2 | `ItemsField` `rowDetail`                | global     | —          | composition-patterns · fe-test-generation               | `ItemsField` tests | Claude   | done   |
| L-3 | The chips, the rail, Same days for all  | structural | L-1, L-2   | frontend-design · ui-ux-pro-max · web-design-guidelines | §8 rows 1–5        | Claude   | done   |
| L-4 | Copy in 11 locales; docs                | copy       | L-3        | fe-i18n-constants · fe-documentation-maintenance        | i18n gates, sync   | Claude   | done   |
| L-5 | Verify in the running app; gates; close | verify     | L-4        | fe-kickoff-iteration · fe-before-commit-guard           | §8 row 6           | Claude   | done   |
