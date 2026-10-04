# `pages/organization/$organizationSlug/medical/manufacturers` — Medical › Manufacturers

Route: `/organization/$organizationSlug/medical/manufacturers` (KICKOFF §6.7, L-50). Same gates as
the Medical room.

Every manufacturer (`medical.md:89–103`): the maker's pill in its tone · Medicines · Suppliers (grey) · MRs (mint); the row edge is the maker's tone. Filters: the automatic Suppliers and MRs sections · Created; the footer counts the makers. A row opens Edit manufacturer.

The search, filters and sort live in the URL (the room reads them in `../medical.search.ts`); the list read follows them —
a sort keeps the rows until the new page arrives, a search or "Apply filter" shows the skeleton.
A failed read keeps the last copy and toasts "Retry".

## Dialog routes

`create/` (New manufacturer) · `$manufacturerId/edit/` (Edit manufacturer) — each renders nothing; this page reads the URL and opens the drawer over the
list (D24): the Manufacturer drawer (`../shared/components/ManufacturerDrawer/`), with a supplier or MR stacked on it. Delete, only while no medicine names the maker, asks for a reason.

## Files

| File                            | Responsibility                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `manufacturers.route.tsx`       | Route marker — exports `Component` rendering `ManufacturersPage`.                                       |
| `manufacturers.manifest.ts`     | Manifest — `kind: 'layout'` over its dialog routes, module `clinic-medical`.                            |
| `manufacturers.params.ts`       | The list read from the URL (defaults applied, the tab's own sort keys) and its filter key.              |
| `ManufacturersPage.tsx`         | The tab: the Medical toolbar, the table, its row actions and states; hosts the dialog routes' `Outlet`. |
| `hooks/useManufacturerColumns/` | The columns: tracks, folds (the meta line and the phone key), sort ids, the recommended set.            |

## Test ids

`medical-manufacturers-page`; the shared toolbar and table ids prefixed `medical-manufacturers`.
