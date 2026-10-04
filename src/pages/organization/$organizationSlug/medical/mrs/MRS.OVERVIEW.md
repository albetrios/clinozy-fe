# `pages/organization/$organizationSlug/medical/mrs` — Medical › MRs

Route: `/organization/$organizationSlug/medical/mrs` (KICKOFF §6.7, L-50). Same gates as
the Medical room.

Every medical representative (`medical.md:105–119`): MR (and phone) · Represents · Last visit · Next visit (sky ahead, blush once past — against today) · Samples (hidden); no status edge. Filters: Created; the footer counts the MRs. A row opens Edit MR; "Log visit" opens Log MR visit.

The search, filters and sort live in the URL (the room reads them in `../medical.search.ts`); the list read follows them —
a sort keeps the rows until the new page arrives, a search or "Apply filter" shows the skeleton.
A failed read keeps the last copy and toasts "Retry".

## Dialog routes

`create/` (New MR) · `$mrId/edit/` (Edit MR) · `$mrId/visits/create/` (Log MR visit) — each renders nothing; this page reads the URL and opens the drawer over the
list (D24): the MR drawer (`../shared/components/MrDrawer/`), with a manufacturer stacked on it, and Log MR visit (`components/MrVisitDrawer/`). Delete asks for a reason.

## Files

| File                        | Responsibility                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `mrs.route.tsx`             | Route marker — exports `Component` rendering `MrsPage`.                                                   |
| `mrs.manifest.ts`           | Manifest — `kind: 'layout'` over its dialog routes, module `clinic-medical`.                              |
| `mrs.params.ts`             | The list read from the URL (defaults applied, the tab's own sort keys) and its filter key.                |
| `MrsPage.tsx`               | The tab: the Medical toolbar, the table, its row actions and states; hosts the dialog routes' `Outlet`.   |
| `hooks/useMrColumns/`       | The columns: tracks, folds (the meta line and the phone key), sort ids, the recommended set.              |
| `components/MrVisitDrawer/` | Log MR visit: the visit's day, the next visit ("2 weeks" · "1 month" from the visit), samples and a note. |

## Test ids

`medical-mrs-page`; the shared toolbar and table ids prefixed `medical-mrs`; `rep-drawer`, `rep-visit-drawer`.
