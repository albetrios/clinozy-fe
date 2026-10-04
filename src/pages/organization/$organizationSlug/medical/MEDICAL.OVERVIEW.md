# `pages/organization/$organizationSlug/medical` — Medical

Route: `/organization/$organizationSlug/medical`. The in-house medicine store: medicines with
batches and expiry, sales to patients and Medical contacts, purchase orders, suppliers,
manufacturers, MRs and the Medical slice of the payments ledger (KICKOFF §6.7; the intake’s Medical spec).

Gated like every clinic room: membership (`organization:read`) and the `clinic-medical`
module, then `requireOrgStatus`; in-room View / Create / Edit / Delete come from
`useClinicAccess` (KICKOFF §3.7) — without Create the split "New" and the tabs' "New …" hide,
without Edit the row actions that change a record go.

## The room (L-50)

A layout over seven literal tab routes (D24): `sales/` (where `/medical` lands, D25) ·
`medicines/` · `purchases/` · `suppliers/` · `manufacturers/` · `mrs/` · `payments/`. Each tab
renders the family's Medical toolbar and its table:

- **Toolbar** (`shared/components/MedicalToolbar/`): h1 "Medical" · the seven tabs on the shared
  room tabs folding into "More ⌄" when the measured space runs out (the current tab alone beside
  "More" on a phone; More's list grouped Selling · Stock · Buying · Money) · search · saved views
  · Filters · Columns · the tab's view action · the split "+ New <thing>" whose "⌄" Create menu
  holds every other create, grouped Selling · Stock · Buying. A create opens over its own tab
  (a standing deviation, §6.7).
- **Tables** (`shared/components/MedicalTable/`): the shared table with folds on a tablet and
  rows on a phone, selection and the bulk bar from `md` (Export as CSV), infinite scroll over
  cursor pages, the footer count and the end line, and the blush empty state with the tab's
  "New …".
- **Data**: medicines are the shared `@/shared/api/clinic/medicines-api.ts` (the Invoice and Rx
  drawers read them) with their stock rules in `@/shared/api/clinic/medicine-stock.ts`; the
  rest is the family's `shared/medical-api.ts` over the fixture world (`REPLACE_WITH_API`).

The search, filters and sort of every tab live in the URL (`medical.search.ts`, one reader for
all tabs, on the entry chunk); each tab's list read is its own `<tab>.params.ts`.

## Files

| File                     | Responsibility                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `medical.route.tsx`      | Route marker — exports `Component` rendering `MedicalLayout`.                                        |
| `medical.manifest.ts`    | Manifest — `kind: 'layout'` over the seven tabs, module `clinic-medical`, nav section `medical`.     |
| `medical.constants.ts`   | `MEDICAL_NS` / `MEDICAL_KEYS` (the `medical` namespace) and the tabs' table ids.                     |
| `medical.search.ts`      | The tabs' URL reader (`validateMedicalSearch`) and the dialog routes' prefills.                      |
| `MedicalLayout.tsx`      | Layout over the tab routes (`<Outlet />`).                                                           |
| `shared/`                | Family-shared: contracts, api, tones, filters, params; the toolbar, table and cells; the list hooks. |
| `__tests__/integration/` | The tabs end to end; `__tests__/integration/medical-test-router.tsx` mirrors the family's routes.    |

## Test ids

`medical-page`; each tab's `medical-<tab>-page` and the shared toolbar and table ids prefixed
`medical-<tab>` (`medical-sales-toolbar`, `medical-sales-tab-medicines`, `medical-sales-new`,
`medical-sales-new-menu`, `medical-sales-table-row`); the view action
`medical-<tab>-view-action-<id>`.
