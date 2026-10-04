# `pages/organization/$organizationSlug/offerings` — Offerings

Route: `/organization/$organizationSlug/offerings`. What the clinic sells: offerings, packages, offers
and prices (KICKOFF §6.11; the offerings spec). The bare URL is the **Offerings** tab; the **Offers** tab is
its literal child route, a page of its own (D24) — see `offers/OFFERS.OVERVIEW.md`. The room's tabs are
links between the two, not state.

Gated like every clinic room: membership (`organization:read`) and the `clinic-offerings` module, then
`requireOrgStatus`; in-room View / Create / Edit / Delete come from `useClinicAccess` (KICKOFF §3.7;
Q-O1: Admin and Owner hold everything, Counsellor views). Bulk Export needs the `export` ability, the
Lowest price control `floor`, and changing a saved offering's prices `prices` (Q-U8).

The catalogue is small, so both tabs read every cursor page up front (`useOfferings` / `useOffers`) and
search, filter and sort in place (KICKOFF §6.11 Lists). Each row is priced for the header's branch with
`effectivePrice` (`src/shared/api/clinic/offerings-pricing.ts`, Q-O2, D40). The Filters sections are
built from the values the rows show — a column gets one with 2–10 values, fewer than the rows
(`offerings.md:187`) — then Created. A failed read keeps the last copy and toasts "Retry"
(`useListLoadError`).

The Offering drawer opens over the list from its two dialog routes (`create/`, `$offeringId/edit/`,
D24): "New offering" (toolbar, phone pill, empty catalogue), a row click or a row's Edit. It is two
steps, or three while an offer that has not ended names the offering; the draft is priced live for
the header's branch. A save closes it onto the list with the write's toast (D28); reopening the same
record returns to the step it had open.

## Files

| File                                        | Responsibility                                                                                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `offerings.route.tsx`                       | Route marker — exports `Component` rendering `OfferingsPage`.                                                                                                                                                                         |
| `offerings.manifest.ts`                     | Manifest — `kind: 'layout'`, children `create`, `$offeringId`, `offers`; permission `organization:read`, module `clinic-offerings`, nav.                                                                                              |
| `offerings.search.ts`                       | `validateOfferingsSearch` (`q`, `category`, `offer`, `branch`, `status`, `created`, `sort`; `specialty` left raw, Q-O6), `validateOfferingCreateSearch` (`?name=`), on the same shared readers as Offers. In the entry chunk: no zod. |
| `offerings.constants.ts`                    | `OFFERINGS_NS` / `OFFERINGS_KEYS` (the Offerings tab's copy), `OFFERINGS_TABLE_ID`.                                                                                                                                                   |
| `offerings.rows.ts`                         | Pure: rows priced for a branch, search, the Filters sections the rows hold, filtering, the URL's sort.                                                                                                                                |
| `OfferingsPage.tsx`                         | The Offerings tab: toolbar (New offering), the shared table (folds, phone rows keyed on Price; row click and Edit open the drawer), row Delete, bulk Export, states, the Offering drawer.                                             |
| `create/`                                   | Dialog route — New offering (renders nothing; this page opens the drawer). See `create/CREATE.OVERVIEW.md`.                                                                                                                           |
| `$offeringId/edit/`                         | Dialog route — Edit offering; the `$offeringId` segment has no page of its own. See `$offeringId/edit/EDIT.OVERVIEW.md`.                                                                                                              |
| `components/OfferingCells/`                 | The tab's cells (Offering, Category, Price, Offer, Duration, Sessions, Status) and `useOfferingText`.                                                                                                                                 |
| `components/OfferingDrawer/`                | The Offering drawer: the form (`components/OfferingDrawer/offering-form.ts`), its view — live pricing, badges, step heads (`components/OfferingDrawer/offering-drawer-view.ts`) — the fields, the save and its outcomes.              |
| `hooks/useOfferingsTable/`                  | The table instance: columns, tracks, folds, URL sort, hidden columns (Updated).                                                                                                                                                       |
| `hooks/useOfferingsDialogRoute/`            | Which drawer the URL opens over the list (`create` / `edit` / none) and how it closes.                                                                                                                                                |
| `shared/components/OfferingsToolbar/`       | Family-shared: the toolbar both tabs draw (h1, link tabs, search, Filters, Columns, New).                                                                                                                                             |
| `shared/components/CatalogueCells/`         | Family-shared cells: `CellText`, `BranchChips`, `SavedByCell`, the Branches fold and filter copy.                                                                                                                                     |
| `shared/components/CatalogueDeleteConfirm/` | Family-shared: the reason confirm for an offering or an offer, with the 10s Undo.                                                                                                                                                     |
| `shared/hooks/useOfferingsCatalogue/`       | Family-shared: the catalogue, its offers, branches, pricing branch and team in one read.                                                                                                                                              |
| `shared/hooks/useOfferLabels/`              | Family-shared: an offer's value, kind, state and days as words.                                                                                                                                                                       |
| `shared/hooks/useRememberedStep/`           | Family-shared: a drawer's open step, back where it was when the same record reopens.                                                                                                                                                  |
| `shared/offerings-filters.ts`               | Family-shared, pure: the "2–10 values" section rule and the Branches values.                                                                                                                                                          |
| `__tests__/integration/`                    | The family's router harness (both tabs and the drawer's dialog routes as the route tree registers them).                                                                                                                              |

## Test ids

`offerings-page` (root), `offerings-table` and the shared table's ids prefixed `offerings-…`, the toolbar's
(`offerings-toolbar`, `offerings-search`, `offerings-filters-trigger` …), the tabs `offerings-tabs`,
`offerings-tab-offerings`, `offerings-tab-offers` (the same on both tabs), `offerings-new-button`, and the
drawer `offering-drawer` with its parts (`offering-drawer-name`, `offering-drawer-price` …). Listed in
`docs/reference/e2e-testids-inventory.md`.
