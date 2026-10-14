# Today stops offering Dispense once the prescription is sold — kickoff plan

> **Status: approved on 2026-10-14** on the user's request to fix it on a branch of its own, in a
> new iteration, and raise the pull request (D9). Every decision is in
> [`plans/decisions.md`](plans/decisions.md) and can be reopened by moving the iteration back to
> `planning`. `fe-kickoff-iteration` builds §6 in ledger order (§9); what was actually built goes in
> `AS-BUILT.md`.

## 1. Header

| Field            | Value                                                                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Iteration · mode | `iterations/fix-today-dispense-refresh-2026-10-14-zwaa/` · **incremental** (type `fix`, Baseline `launch-2026-09-30-jxmr`, D4)                                                                            |
| Intake           | mode `brief` · note "1 received (BRIEF.md) · 22 carried forward from launch-2026-09-30-jxmr" · placed 2026-10-14 · Intake hash `70522816a86b` · Schema-routes as the Baseline's                           |
| Date             | 2026-10-14                                                                                                                                                                                                |
| Sources          | `intake-files/BRIEF.md` (the change); the carried-forward `today.md` (Pharmacy lane, `today.md:46`, `:163`) and `medical.md`; the Baseline's `AS-BUILT.md` and its Standing deviations; the code as built |
| Evidence         | `BRIEF.md:n` = brief line n · `today.md:n` = the carried-forward screen spec · `path:n` = this repo                                                                                                       |
| Planned by       | `fe-iteration-planning` (this file)                                                                                                                                                                       |
| Built by         | `fe-kickoff-iteration`, driving the skills named per ledger row (§9)                                                                                                                                      |
| Sibling          | none — frontend only (D5)                                                                                                                                                                                 |

## 2. Locked decisions

All in [`plans/decisions.md`](plans/decisions.md), locked with the approval on 2026-10-14.

| #   | Decision                                                                                   |
| --- | ------------------------------------------------------------------------------------------ |
| D1  | A sale saved from Dispense refreshes Today's floor; the card loses Dispense without reload |
| D2  | A new `fix` iteration — the Baseline is frozen                                             |
| D3  | Branch `fix/today-dispense-refresh` from `main`, a new pull request                        |
| D4  | Baseline `launch-2026-09-30-jxmr`, Intake mode `brief`                                     |
| D5  | Frontend only — clinozy-be already answers right                                           |
| D6  | Every sale write refreshes Today, through the one `SALE_KEYS` list                         |
| D7  | `todayQueryKeys.floors()`, as prescription writes do; no new read                          |
| D8  | The patient file's "Sell medicines" is out of scope                                        |
| D9  | Approved on the request; the pull request is the checkpoint                                |

## 3. Foundation (before any screen)

- **Theme preset** — n/a: no token or class changes.
- **Shell** — n/a.
- **Stores** — n/a: TanStack Query owns the floor; the change is a key in an invalidation list.
- **Icons** — none.

## 4. Route / island map

No route, island, manifest or dialog route changes. New sale over Today stays
`…/medical/sales/create?prescription=&customer=` on the cross-room host (`SaleDrawers.tsx:40–55`).

## 5. State management map

| Read                                      | Key                                                                     | Refreshed by today                                                                                       | Refreshed by after this change   |
| ----------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Today's floor (lanes; the pharmacy queue) | `todayQueryKeys.floor()` under `['app', 'appointments', 'today-floor']` | appointment and visit writes (its prefix), prescription writes (`usePrescriptions.ts:196`), its 60s poll | + every sale write (`SALE_KEYS`) |
| Medical › Sales › Prescriptions to fill   | `medicalQueryKeys.prescriptionsToFill()` under `['app', 'medical']`     | every sale write (`MEDICINE_WRITE_KEYS`)                                                                 | unchanged                        |

## 6. Per-screen build notes

### 6.1 A sale write refreshes Today's floor — `fe-test-generation`

`src/pages/organization/$organizationSlug/medical/shared/hooks/useMedicalFlows/useMedicalFlows.ts`:
`SALE_KEYS` (line 101) gains `todayQueryKeys.floors()` (from `@/shared/api/app/today-api.ts`, the
module `usePrescriptions` already imports it from), and its doc comment says why — Today's pharmacy
cards read the queue of prescriptions still to fill, which a sale fills and a void empties.

Test (`useMedicalFlows.test.tsx`): New sale and Void each invalidate `todayQueryKeys.floors()`;
the existing "collect, return and void refresh the ledger…" test keeps its assertions.

Docs: `MEDICAL.OVERVIEW.md` (the flows paragraph) and `TODAY.OVERVIEW.md` (`useFloorActions` row:
the card loses Dispense once the sale is saved).

## 7. Deviations

### 7.1 md over prototype

None. `today.md:46` says Dispense is for a "prescription to dispense"; this makes the card follow it
as soon as the sale is saved.

### 7.2 Project rules over the source

None.

### 7.3 Standing deviations

The Baseline's list carries forward unchanged; none is about Dispense or the floor's refresh, and
this iteration adds none.

## 8. Verification

By Intake mode `brief`: each `BRIEF.md` acceptance criterion, checked.

- Unit: `useMedicalFlows.test.tsx`, the Today and Medical suites (`pnpm test` in full on push).
- `pnpm type-check`, `pnpm lint`, `pnpm biome:check`, `pnpm docs:lint`, `pnpm sync:check`,
  `pnpm tsdoc:check`.
- The running app against clinozy-be at 1440: a walk-in with an approved prescription in the
  Pharmacy lane → Dispense → save the sale → the card without Dispense, no reload — recorded, beside
  the Baseline's recording of the same steps (where the card kept Dispense).

## 9. The route — the ordered ledger

| #   | Ledger row                       | Skill                                                | Done when                                                                 |
| --- | -------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| L-1 | Sale writes refresh Today (§6.1) | `fe-test-generation`, `fe-documentation-maintenance` | `SALE_KEYS` holds the floor's key; its tests say so; the overviews say so |
| L-2 | Verify in the running app        | `fe-playwright-e2e`                                  | Dispense → save → the card without Dispense, no reload, recorded at 1440  |
| L-3 | Gates and close                  | `fe-code-quality-security`                           | §8 green; `AS-BUILT.md`; Status `done`, then `frozen`                     |

## Appendix A — Coverage matrix

| `BRIEF.md` acceptance criterion                                | Ledger row |
| -------------------------------------------------------------- | ---------- |
| After a sale from Dispense, the card no longer offers Dispense | L-1, L-2   |
| Every sale write refreshes Today's floor; a unit test pins it  | L-1        |
| The running app shows it at 1440                               | L-2        |
