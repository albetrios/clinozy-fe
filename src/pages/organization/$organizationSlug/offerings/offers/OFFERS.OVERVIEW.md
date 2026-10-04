# `pages/organization/$organizationSlug/offerings/offers` — Offers

Route: `/organization/$organizationSlug/offerings/offers`. The Offers tab of the Offerings room (KICKOFF
§6.11 Offers tab; `offerings.md:41–55`, `S:101`): the limited-time prices on the catalogue. A literal
child route (D24) registered beside the Offerings tab in `src/app/routes/routeTree.tsx`, so each tab is a page of its
own; the room's toolbar (family-shared, `../shared/components/OfferingsToolbar/`) links the two.

Every offer is read up front and searched (name, code, an offering's name), filtered (Branches · Status
sections built from the rows, then Created) and kept in the tab's fixed order — Running → Scheduled →
Paused → Ended, newest first in each (H:5477). No column sorts. Same gates as the room; in-room access is
`useClinicAccess`.

## Files

| File                     | Responsibility                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `offers.route.tsx`       | Route marker — exports `Component` rendering `OffersPage`.                                            |
| `offers.manifest.ts`     | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-offerings`; not in the nav. |
| `offers.search.ts`       | `validateOffersSearch` (`q`, `status`, `branch`, `created`), on the parent's readers.                 |
| `offers.constants.ts`    | `OFFERS_NS` / `OFFERS_KEYS` (the tab's copy, `offers.*` in the room's namespace), `OFFERS_TABLE_ID`.  |
| `offers.rows.ts`         | Pure: rows with their state in the tab's order, the Filters sections, filtering.                      |
| `OffersPage.tsx`         | The Offers tab: toolbar, the shared table (folds, phone rows keyed on Type), row Delete, Export.      |
| `components/OfferCells/` | The tab's cells (Offer, Type, Applies to, Valid, Status) and `useOfferText`.                          |
| `hooks/useOffersTable/`  | The table instance: columns, tracks, folds, hidden columns (Updated).                                 |

## Test ids

`offers-page` (root), `offers-table` and the shared table's ids prefixed `offers-…`, the toolbar's
(`offers-toolbar`, `offers-search`, `offers-filters-trigger` …) and `offers-new-button`; the tabs keep
the room's `offerings-tab-…` ids. Listed in `docs/reference/e2e-testids-inventory.md`.
