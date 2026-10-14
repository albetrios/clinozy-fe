# An empty list shows no create or add button — kickoff plan

> **Status: approved on 2026-10-14** on the user's request to make the change and push it to the open
> pull request (D9). Every decision is in [`plans/decisions.md`](plans/decisions.md) and can be
> reopened by moving the iteration back to `planning`. `fe-kickoff-iteration` builds §6 in ledger
> order (§9); what was actually built goes in `AS-BUILT.md`.

## 1. Header

| Field            | Value                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Iteration · mode | `iterations/fix-empty-state-actions-2026-10-14-iazm/` · **incremental** (type `fix`, Baseline `change-empty-states-2026-10-13-ssai`, D4)                                                 |
| Intake           | mode `brief` · note "1 received (BRIEF.md) · 7 carried forward from change-empty-states-2026-10-13-ssai" · placed 2026-10-14 · Intake hash `6d624c26d00b` · Schema-routes `dc1fa4c9a7bc` |
| Date             | 2026-10-14                                                                                                                                                                               |
| Sources          | `intake-files/BRIEF.md` (the change); the carried-forward `empty-states.md` inventory (rows R8–R38); the Baseline's `AS-BUILT.md` and its Standing deviations; the code as built         |
| Evidence         | `BRIEF.md:n` = brief line n · `R<n>` = `empty-states.md` inventory row · `path:n` = this repo                                                                                            |
| Planned by       | `fe-iteration-planning` (this file)                                                                                                                                                      |
| Built by         | `fe-kickoff-iteration`, driving the skills named per ledger row (§9)                                                                                                                     |
| Sibling          | none — frontend only (D5)                                                                                                                                                                |

## 2. Locked decisions

All in [`plans/decisions.md`](plans/decisions.md), locked with the approval on 2026-10-14.

| #   | Decision                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------ |
| D1  | Every empty list loses its create/add button; the illustration, title and line stay                    |
| D2  | A new `fix` iteration — the Baseline is frozen                                                         |
| D3  | Built on `feat/colorful-empty-states`, pushed to albetrios/clinozy-fe#65                               |
| D4  | Baseline `change-empty-states-2026-10-13-ssai`, Intake mode `brief`                                    |
| D5  | Frontend only                                                                                          |
| D6  | "Clear filters" stays                                                                                  |
| D7  | Retry, the suspended page, the invitation page, "Clear search" and the picker's retry are out of scope |
| D8  | The props, locals, test ids and three locale keys only those buttons used go with them                 |
| D9  | Approved on the request; the pull request is the checkpoint                                            |

## 3. Foundation (before any screen)

- **Theme preset** — n/a: no token or class changes. The empty state's art is untouched.
- **Shell** — n/a.
- **Stores** — n/a.
- **Icons** — none added or removed.

## 4. Route / island map

No route, island, manifest or dialog route changes. The create routes the buttons opened
(`…/appointments/create`, `…/leads/create`, the Medical and Clinic stock `create` dialogs, Offerings'
`create/`) stay, reached from the toolbars as before.

## 5. State management map

No change. The empty states lose callback props only.

## 6. Per-screen build notes

### 6.1 The empty states lose their button — `fe-test-generation`

One change, applied where each room draws its empty state (`BRIEF.md` › What changes):

| Row      | Where                                                                                                   | Removed                                                     |
| -------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| R10      | `appointments/components/AppointmentsAgenda/AppointmentsAgenda.tsx` › `AgendaEmpty`                     | "New appointment" (`appointments-book-one`)                 |
| R8       | `leads/LeadsPage.tsx` › `LeadsEmpty`                                                                    | "New lead"                                                  |
| R34      | `tasks/components/TaskList/TaskList.tsx` › `EmptyLine`; `TasksPage.tsx`                                 | "New task" (`tasks-empty-new`) and `TaskList`'s `onNewTask` |
| R15      | `patients/$patientId/images/PatientImagesPage.tsx` › `PhotosEmpty`                                      | "Upload images"                                             |
| R21–R31  | `shared/components/RoomTable/` (`emptyAction`), `RoomTableEmpty/` (`action`); 7 Medical + 3 Stock pages | the tab's "New …"                                           |
| R32, R33 | `payments/PaymentsPage.tsx` › `LedgerEmpty`; `payments/pending/PendingPage.tsx` › `PendingEmpty`        | "Receive", "Add pending"                                    |
| R37, R38 | `offerings/OfferingsPage.tsx` › `TableEmpty`; `offerings/offers/OffersPage.tsx` › `TableEmpty`          | "New offering", "New offer"                                 |

Tests: each room's empty-state test asserts **no button** inside the empty state (instead of
clicking it); the filtered tests keep clicking "Clear filters" (D6).

### 6.2 What only the buttons used — `fe-i18n-constants`, `fe-e2e-testids`, `fe-documentation-maintenance`

The props and locals in §6.1, the two test ids and three locale keys (D8), in all eleven locales.
Docs: `docs/reference/e2e-testids-inventory.md` (Leads, Tasks, Appointments rows), `MEDICAL.OVERVIEW.md`,
`OFFERINGS.OVERVIEW.md`, `IMAGES.OVERVIEW.md`, `TASKS.OVERVIEW.md`.

## 7. Deviations

### 7.1 md over prototype

None. The prototype (`empty-states.html`) draws the button; the brief removes it, and the brief is
the newer word.

### 7.2 Project rules over the source

None.

### 7.3 Standing deviations

The Baseline's five carry forward unchanged (art size, tile paint, compact art, icons, dark tones).
This iteration adds one: the inventory's Action column (`empty-states.md` R8–R38) is no longer drawn.

## 8. Verification

By Intake mode `brief`: each `BRIEF.md` acceptance criterion, checked.

- Unit: the touched rooms' suites (`pnpm test` in full on push).
- `pnpm type-check`, `pnpm lint`, `pnpm biome:check`, `pnpm validate:testids`, `pnpm validate:i18n`,
  `pnpm docs:lint`, `pnpm sync:check`, `pnpm tsdoc:check`.
- The running app: every affected empty state at 1440 and 375, light and dark, against the
  Baseline's build; the room visual baselines (`tests/e2e/visual.e2e.test.ts` › clinic rooms)
  rewritten.
- `pnpm size` built as CI: no growth (the change only removes code).

## 9. The route — the ordered ledger

| #   | Ledger row                 | Skill                                                                 | Done when                                                                     |
| --- | -------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| L-1 | Remove the buttons (§6.1)  | `fe-test-generation`                                                  | No empty list in §6.1 renders a button; its tests say so                      |
| L-2 | What only they used (§6.2) | `fe-i18n-constants`, `fe-e2e-testids`, `fe-documentation-maintenance` | Type-check clean; the ids and keys are gone from code, tests, docs, locales   |
| L-3 | Verify in the running app  | `fe-visual-regression`, `fe-playwright-e2e`                           | Every affected room seen at 1440 and 375, light and dark; baselines rewritten |
| L-4 | Gates and close            | `fe-code-quality-security`                                            | §8 green; `AS-BUILT.md`; Status `done`, then `frozen`                         |

## Appendix A — Coverage matrix

| `BRIEF.md` acceptance criterion                       | Ledger row |
| ----------------------------------------------------- | ---------- |
| No empty list renders a button inside its empty state | L-1, L-3   |
| Filtered empty states still offer "Clear filters"     | L-1        |
| Each toolbar still offers its "New …" with Create     | L-1, L-3   |
| `appointments-book-one`, `tasks-empty-new` are gone   | L-2        |
| The buttons' strings are gone from all eleven locales | L-2        |
| The visual baselines show no button                   | L-3        |
