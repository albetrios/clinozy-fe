# `pages/organization/$organizationSlug/offerings` — Offerings

Route: `/organization/$organizationSlug/offerings`. What the clinic sells: offerings, packages, offers
and prices (KICKOFF §6.11; the offerings spec). The bare URL is the **Offerings** tab; the **Offers** tab is
its literal child route, a page of its own (D24) — see `offers/OFFERS.OVERVIEW.md`. The room's tabs are
links between the two, not state.

Gated like every clinic room: membership (`organization:read`) and the `app-offerings` module, then
`requireOrgStatus`. In the room every control asks for the member's own clinozy-be code
(`useAppAccess().canCode`, research §7): New offering `offering:create`, a row's Edit
`offering:update`, Delete (and its Undo) `offering:delete`, bulk Export `offering:export`
(`canExportRows`), the Lowest price `offering:lower_price:read`. Owner and Admin hold them all;
a Counsellor creates and edits; a Doctor, Pharmacist or Accountant exports. A row click opens the drawer
for everyone — view only without `offering:update`. During View-as every code reads false, so every
code-gated control hides.

The room is on clinozy-be (D153; `app-offerings` is out of `FIXTURE_BACKED_APP_MODULES`). Both
tabs read `GET /app/offerings` and `GET /app/offers` (`useOfferings` / `useOffers`): the catalogue is
small, so every cursor page is read up front and kept in the server's order (offerings newest first;
offers live → scheduled → paused → ended), then searched, filtered and sorted in place (KICKOFF §6.11
Lists). It is the clinic's one catalogue: the appointment form's "From offerings", a check-in's offerings
and the plan card select their own shape from the same cache entry (`useOfferings({ select })`), so this
room's writes refresh them too. Money is rupees as the API sends them (`useRupeeFormat`). Each row is priced for the
header's branch with `effectivePrice` (`src/shared/api/app/offerings-pricing.ts`, Q-O2, D40) — only
the offers the server calls `live` count, and a floor the member cannot see (`min_price` null) clamps
nothing. A product's Duration reads "—". The Filters sections are built from the values the rows show — a
column gets one with 2–10 values, fewer than the rows (`offerings.md:187`) — then Created. A first read
that fails shows the error in place with Retry (`RetryError`); a later one keeps the last copy and toasts
"Retry" (`useListLoadError`). Delete is the reason confirm (`DELETE /app/offerings/:offering_id?reason=&note=`, 204) with the toast's Undo (`POST …/restore`). No one is named as the last to save a row: the API keeps no
saver (G10), so Updated shows the time alone.

The Offering drawer opens over the list from its two dialog routes (`create/`, `$offeringId/edit/`,
D24): "New offering" (toolbar, phone pill), a row click or a row's Edit — the edit route
carries the offering's public id (`off_…`) and reads it (`GET /app/offerings/:offering_id`). It is two
steps, or three while an offer that has not ended names the offering; the draft is priced live for
the header's branch. Money is typed in rupees; GST is one of the API's rates (chips: 0 · 5 · 12 · 18 ·
28 — the category's until one is picked); the Lowest price is there only for `offering:lower_price:read`
and never sent otherwise. A save sends only what changed with `expected_updated_at` — a stale save
(`409 record_changed`) offers Reload, which restarts the form on what was saved; a taken name outlines
Name; a refusal lands on its field (a hidden floor's on the Offer price or Price). A save closes the drawer
onto the list with the write's toast (D28); reopening the same record returns to the step it had open.

## Files

| File                                        | Responsibility                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `offerings.route.tsx`                       | Route marker — exports `Component` rendering `OfferingsPage`.                                                                                                                                                                                                                                                                   |
| `offerings.manifest.ts`                     | Manifest — `kind: 'layout'`, children `create`, `$offeringId`, `offers`; permission `organization:read`, module `app-offerings`, nav.                                                                                                                                                                                           |
| `offerings.search.ts`                       | `validateOfferingsSearch` (`q`, `category`, `offer`, `branch`, `status`, `created`, `sort`; `specialty` left raw, Q-O6), on the same shared readers as Offers. In the entry chunk: no zod.                                                                                                                                      |
| `offerings.dialog-search.ts`                | New offering's `?name=` — parsed by `useOfferingsDialogRoute`; loads with the room.                                                                                                                                                                                                                                             |
| `offerings.constants.ts`                    | `OFFERINGS_NS` / `OFFERINGS_KEYS` (the Offerings tab's copy), `OFFERINGS_TABLE_ID`.                                                                                                                                                                                                                                             |
| `offerings.rows.ts`                         | Pure: rows priced for a branch in the server's order, search, the Filters sections the rows hold, filtering, the URL's sort, a product's duration as none.                                                                                                                                                                      |
| `OfferingsPage.tsx`                         | The Offerings tab: toolbar (New offering), the shared table (folds, phone rows keyed on Price; row click and Edit open the drawer), row Delete, bulk Export — each by its code — loading, empty and error states, the Offering drawer.                                                                                          |
| `create/`                                   | Dialog route — New offering (renders nothing; this page opens the drawer). See `create/CREATE.OVERVIEW.md`.                                                                                                                                                                                                                     |
| `$offeringId/edit/`                         | Dialog route — Edit offering; the `$offeringId` segment has no page of its own. See `$offeringId/edit/EDIT.OVERVIEW.md`.                                                                                                                                                                                                        |
| `components/OfferingCells/`                 | The tab's cells (Offering, Category, Price in rupees, Offer, Duration, Sessions, Status) and `useOfferingText`.                                                                                                                                                                                                                 |
| `components/OfferingDrawer/`                | The Offering drawer: the form (`components/OfferingDrawer/offering-form.ts`), its view — live pricing, badges, step heads (`components/OfferingDrawer/offering-drawer-view.ts`) — the fields, the save and its outcomes, refusals re-addressed to the fields the member sees (`components/OfferingDrawer/offering-refusal.ts`). |
| `hooks/useOfferingsTable/`                  | The table instance: columns, tracks, folds, URL sort, hidden columns (Updated).                                                                                                                                                                                                                                                 |
| `hooks/useOfferingsDialogRoute/`            | Which drawer the URL opens over the list (`create` / `edit` by public id / none), the dead links it sends back (`useDialogRouteRecord`'s `isWellFormed`: a non-public id is never sent), and how it closes.                                                                                                                     |
| `shared/components/OfferingsToolbar/`       | Family-shared: the toolbar both tabs draw (h1, link tabs, search, Filters, Columns, New).                                                                                                                                                                                                                                       |
| `shared/components/CatalogueCells/`         | Family-shared cells: `CellText`, `BranchChips`, `UpdatedCell`, the Branches fold and filter copy.                                                                                                                                                                                                                               |
| `shared/components/CatalogueDeleteConfirm/` | Family-shared: the reason confirm for an offering or an offer, with the 10s Undo.                                                                                                                                                                                                                                               |
| `shared/hooks/useOfferingsCatalogue/`       | Family-shared: the catalogue, its offers, branches and pricing branch in one read.                                                                                                                                                                                                                                              |
| `shared/hooks/useOfferLabels/`              | Family-shared: an offer's value, kind, state and days as words.                                                                                                                                                                                                                                                                 |
| `shared/hooks/useRememberedStep/`           | Family-shared: a drawer's open step, back where it was when the same record reopens.                                                                                                                                                                                                                                            |
| `shared/offerings-filters.ts`               | Family-shared, pure: the "2–10 values" section rule and the Branches values.                                                                                                                                                                                                                                                    |
| `__tests__/integration/`                    | The Offerings tab's router harness (the tab and its dialog routes as the route tree registers them; a member holding codes, the Admin's by default; the Offers tab has its own) and its test catalogue and api doubles.                                                                                                         |

## Test ids

`offerings-page` (root), `offerings-table` and the shared table's ids prefixed `offerings-…`, the toolbar's
(`offerings-toolbar`, `offerings-search`, `offerings-filters-trigger` …), the tabs `offerings-tabs`,
`offerings-tab-offerings`, `offerings-tab-offers` (the same on both tabs), `offerings-new-button`, and the
drawer `offering-drawer` with its parts (`offering-drawer-name`, `offering-drawer-price` …). Listed in
`docs/reference/e2e-testids-inventory.md`.
