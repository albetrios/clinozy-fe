# `pages/organization/$organizationSlug/offerings/offers/$offerId/edit` — Edit offer

Route: `/organization/$organizationSlug/offerings/offers/$offerId/edit` — a URL-driven dialog over
the Offers tab (KICKOFF §4, D24; `S:103`). The route renders nothing: the Offers page reads the
URL and opens the offer's drawer over the list, so a refresh or a shared link reopens it. A row
click and a row's Edit come here. The `$offerId` segment has no page of its own — its folder holds
only this island. Gated like the room — membership (`organization:read`) and the
`clinic-offerings` module, then `requireOrgStatus`. The route stays reachable for a viewer: without
`offering:update` the drawer is view only, and without `offering:delete` it has no Delete. The offer is
the list's copy, or — for a deep link the list does not hold yet — its own read
(`GET /app/offers/:offer_id`), with Retry in the drawer when that read fails. An id that names no offer
(a deleted offer's 404, or no `ofr_…` public id at all, which the API refuses with a 400) goes back to
the list in place with "Offer not found · it may have been deleted" (`S:115`). A save sends only what
changed with the read's `updated_at` (`PATCH /app/offers/:offer_id`). The drawer is the tab's `OfferDrawer`
(`../../components/OfferDrawer/`), opened by the page through `../../hooks/useOffersDialogRoute/`.

## Files

| File                | Responsibility                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| `edit.route.tsx`    | Route marker — exports `Component` rendering `EditOfferPage`.                                             |
| `edit.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-offerings`, title "Edit offer". |
| `EditOfferPage.tsx` | Renders nothing — the dialog route's own UI. The drawer mounts on the Offers page.                        |

## Test ids

`offer-drawer` — the drawer the Offers page opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md` › Offer drawer. The route renders no element of its own
(`tooling/validate/test-ids-allowlist.txt`).
