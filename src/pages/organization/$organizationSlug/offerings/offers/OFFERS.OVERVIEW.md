# `pages/organization/$organizationSlug/offerings/offers` — Offers

Route: `/organization/$organizationSlug/offerings/offers`. The Offers tab of the Offerings room (KICKOFF
§6.11 Offers tab; `offerings.md:41–55`, `S:101`): the limited-time prices on the catalogue. A literal
child route (D24) registered beside the Offerings tab in `src/app/routes/routeTree.tsx`, so each tab is a page of its
own; the room's toolbar (family-shared, `../shared/components/OfferingsToolbar/`) links the two.

Every offer is read up front from clinozy-be (`GET /app/offers`, every page via the family's
`useOfferingsCatalogue`) and searched in place (name, code, an offering's name — the server's `q` reads
the first two only), filtered (Branches · Status sections built from the rows, then Created) and kept in
the server's order — Running → Scheduled → Paused → Ended, newest first in each (O10). Each offer's
`status` is the server's, never worked out from its dates; a `₹ off` or fixed value is rupees
(`useRupeeFormat`). No column sorts. Same gates as the room; in-room access is the member's own codes
(`useClinicAccess().canCode`, `OFFER_PERMISSIONS`): New offer `offering:create`; Edit, Pause / Resume
and an editable drawer `offering:update`; Delete (and its Undo) `offering:delete`; Export
`offering:export` (offers have no export route — the client CSV of the selected rows). During View-as
no code counts, so every write control hides.

States: the bars while the offers load; Retry in place (`RetryError`) when the read fails with nothing on
screen — with rows on screen the list keeps them and toasts with Retry; "No offers yet" with "New offer";
"No offerings" in Applies to once every offering an offer named was deleted (OFFERINGS-M4).

The Offer drawer opens over the tab from its two dialog routes (`create/`, `$offerId/edit/`, D24):
"New offer" (toolbar, phone pill, empty list), a row click or a row's Edit. Always three steps — "Offer"
→ "Where it applies" → "Notes" — with one preview per picked offering; a save closes it onto the list
(D28). The drawer sends only what changed with the read's `updated_at` (`PATCH /app/offers/:offer_id`;
the offerings only when their set changed, OFFERINGS-M5); a taken code (`409 offer_code_in_use`) outlines
Code, a stale save (`409 record_changed`) offers "Reload", which reads the offer again, an offering no
longer active is named on the picker, and every other server field error lands on its field. A deep
link whose own read fails shows Retry in the drawer. A row's Pause / Resume (never on an ended offer)
sends `is_active` alone at once — a pause reads Paused straight away, a resume takes the server's status
— with "Navratri glow paused" / "… running again". Delete goes through the family's reason confirm
(`DELETE …?reason=&note=`) and its toast's Undo restores (`POST …/restore`).

## Files

| File                          | Responsibility                                                                                                                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `offers.route.tsx`            | Route marker — exports `Component` rendering `OffersPage`.                                                                                                                                                                                            |
| `offers.manifest.ts`          | Manifest — `kind: 'layout'`, children `create`, `$offerId`; permission `organization:read`, module `clinic-offerings`; not in the nav.                                                                                                                |
| `offers.search.ts`            | `validateOffersSearch` (`q`, `status`, `branch`, `created`), on the shared URL readers.                                                                                                                                                               |
| `offers.constants.ts`         | `OFFERS_NS` / `OFFERS_KEYS` (the tab's copy, `offers.*` in the room's namespace), `OFFERS_TABLE_ID`, `OFFER_PERMISSIONS` (the codes each action needs).                                                                                               |
| `offers.rows.ts`              | Pure: rows in the server's order with their Branches chips, the Filters sections, filtering.                                                                                                                                                          |
| `OffersPage.tsx`              | The Offers tab: toolbar (New offer), the shared table (folds, phone rows keyed on Type; row click and Edit open the drawer), Pause / Resume, Delete, Export, the Offer drawer.                                                                        |
| `create/`                     | Dialog route — New offer (renders nothing; this page opens the drawer). See `create/CREATE.OVERVIEW.md`.                                                                                                                                              |
| `$offerId/edit/`              | Dialog route — Edit offer; the `$offerId` segment has no page of its own. See `$offerId/edit/EDIT.OVERVIEW.md`.                                                                                                                                       |
| `components/OfferCells/`      | The tab's cells (Offer, Type, Applies to, Valid, Status) and `useOfferText`.                                                                                                                                                                          |
| `components/OfferDrawer/`     | The Offer drawer: the form (`components/OfferDrawer/offer-form.ts`), its view — badges, previews, step heads — the fields and the save.                                                                                                               |
| `hooks/useOffersTable/`       | The table instance: columns, tracks, folds, hidden columns (Updated).                                                                                                                                                                                 |
| `hooks/useOffersDialogRoute/` | Which drawer the URL opens over the tab (`create` / `edit` / none), the offer's own read for a deep link (and its failure), and how it closes.                                                                                                        |
| `__tests__/integration/`      | The tab's test harness: `__tests__/integration/offers-test-router.tsx` (the routes for a member holding given codes) and `__tests__/integration/offers-test-data.ts` (the local stack's offers and a double of `shared/api/clinic/offerings-api.ts`). |

## Test ids

`offers-page` (root), `offers-table` and the shared table's ids prefixed `offers-…`, the toolbar's
(`offers-toolbar`, `offers-search`, `offers-filters-trigger` …) and `offers-new-button`; `retry-error`
in place of the rows when the read failed; the tabs keep the room's `offerings-tab-…` ids. The drawer is `offer-drawer` with its parts (`offer-drawer-name` …). Listed in `docs/reference/e2e-testids-inventory.md`.
