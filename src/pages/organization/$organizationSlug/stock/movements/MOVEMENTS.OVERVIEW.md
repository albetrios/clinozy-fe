# `pages/organization/$organizationSlug/stock/movements` — Clinic stock › Movements

Route: `/organization/$organizationSlug/stock/movements` (KICKOFF §6.8, L-51). Same gates as the Clinic
stock room.

Every stock change, newest first (`clinic-stock.md:57–71`): Type (Used blush · Received sage · Adjust sky ·
Damaged butter · Returned lav · Reverted stone · Payment sky; a reverted entry adds a grey "Reverted") ·
Item / party (and its note, or "Purchase #16 · SW-77") · When ("Today 11:05", "25 Sep") · By · Change
("− 1 tube", "+ 24 bottle", "− ₹600"; grey once reverted). One Payment row per purchase with money paid
— derived by the fixture until `listMovements` serves them (Appendix F). Nothing sorts, no row opens and
there is no create; the footer reads "7 entries". On a phone the Item / party leads with the Change as
its key. Filters: the automatic Type section · Created. "Revert" and its confirm arrive with L-51b.

## Files

| File                             | Responsibility                                                               |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `movements.route.tsx`            | Route marker — exports `Component` rendering `MovementsPage`.                |
| `movements.manifest.ts`          | Manifest — `kind: 'leaf'`, module `clinic-stock`.                            |
| `movements.params.ts`            | The list read from the URL and its filter key (no sort: newest first).       |
| `MovementsPage.tsx`              | The tab: the Clinic stock toolbar, the table and its states.                 |
| `hooks/useStockMovementColumns/` | The columns: tracks and folds (the meta line and the phone key); no sorting. |

## Test ids

`stock-movements-page`; the shared toolbar and table ids prefixed `stock-movements`.
