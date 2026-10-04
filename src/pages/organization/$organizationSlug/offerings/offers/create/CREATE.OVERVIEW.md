# `pages/organization/$organizationSlug/offerings/offers/create` — New offer

Route: `/organization/$organizationSlug/offerings/offers/create` — a URL-driven dialog over the
Offers tab (KICKOFF §4, D24; `S:102`). The route renders nothing: the Offers page reads the URL
and opens the New offer drawer over the list, so a refresh or a shared link reopens it. Gated like
the room — membership (`organization:read`) and the `clinic-offerings` module, then
`requireOrgStatus`; in-room, a new offer needs Offerings Create and the `prices` ability (Q-U8) —
without them the list sends the link back with the permission toast. The drawer is the tab's
`OfferDrawer` (`../components/OfferDrawer/`), opened by the page through
`../hooks/useOffersDialogRoute/`; saving or closing it returns to the list with the list's own
params.

## Files

| File                 | Responsibility                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `create.route.tsx`   | Route marker — exports `Component` rendering `NewOfferPage`.                                             |
| `create.manifest.ts` | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-offerings`, title "New offer". |
| `NewOfferPage.tsx`   | Renders nothing — the dialog route's own UI. The drawer mounts on the Offers page.                       |

## Test ids

`offer-drawer` — the drawer the Offers page opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md` › Offer drawer. The route renders no element of its own
(`tooling/validate/test-ids-allowlist.txt`).
