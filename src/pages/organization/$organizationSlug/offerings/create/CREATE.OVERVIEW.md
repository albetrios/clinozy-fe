# `pages/organization/$organizationSlug/offerings/create` — New offering

Route: `/organization/$organizationSlug/offerings/create` — a URL-driven dialog over the
Offerings tab (KICKOFF §4, D24; `S:99`). The route renders nothing: the Offerings page reads
the URL and opens the New offering drawer over the list, so a refresh or a shared link
reopens it. `?name=` prefills the drawer's Name — parsed by `validateOfferingCreateSearch` in
the parent's `../offerings.dialog-search.ts` (at most 120 characters, the contract's; the drawer
keeps the first 60). Gated like the room — membership (`organization:read`) and the
`app-offerings` module, then `requireOrgStatus`; in-room Create is the member's own
`offering:create` (`useAppAccess().canCode`) — without it (or during View-as) the list
sends the link back with the permission toast. The drawer's save is `POST /app/offerings`. The drawer is the room's
`OfferingDrawer` (`../components/OfferingDrawer/`), opened by the page through the parent's
`../hooks/useOfferingsDialogRoute/`; saving or closing it returns to the list with the
list's own params, the prefill dropped.

## Files

| File                  | Responsibility                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `create.route.tsx`    | Route marker — exports `Component` rendering `NewOfferingPage`.                                          |
| `create.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `app-offerings`, title "New offering". |
| `NewOfferingPage.tsx` | Renders nothing — the dialog route's own UI. The drawer mounts on the Offerings page.                    |

## Test ids

`offering-drawer` — the drawer the Offerings page opens for this URL; its parts are listed in
`docs/reference/e2e-testids-inventory.md` › Offering drawer. The route renders no element of
its own (`tooling/validate/test-ids-allowlist.txt`).
