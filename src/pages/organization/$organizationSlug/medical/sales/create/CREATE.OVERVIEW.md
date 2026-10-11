# `pages/organization/$organizationSlug/medical/sales/create` — New sale

Route: `/organization/$organizationSlug/medical/sales/create` — a URL-driven dialog over Medical › Sales (KICKOFF §4,
D24): New sale — the shared Invoice drawer with type Medical locked (§6.7, §6.9; `S:50`), prefilled from `?prescription=&customer=`; `createSale` draws each medicine's stock by earliest expiry. Opened from another room (`from` on the referrer allow-list — Today's Dispense, a prescription's "Sell medicines") it opens over that room, which stays behind it (A-P1, the app's cross-room host rendering `../components/SaleDrawers/`); else it closes to the Sales list. A sale is Medical's create, so a pharmacist without Payments still sells. The route renders nothing: the Sales page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `app-medical` module, then `requireOrgStatus`.

## Files

| File                 | Responsibility                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `create.route.tsx`   | Route marker — exports `Component` rendering `NewSalePage`.                                        |
| `create.manifest.ts` | Manifest — `kind: 'leaf'`, permission `organization:read`, module `app-medical`, title "New sale". |
| `NewSalePage.tsx`    | Renders nothing — the drawer mounts on the Sales page.                                             |

## Test ids

`invoice-drawer` — the drawer the Sales page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
