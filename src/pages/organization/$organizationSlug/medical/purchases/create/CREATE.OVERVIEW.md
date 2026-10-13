# `pages/organization/$organizationSlug/medical/purchases/create` — New purchase order

Route: `/organization/$organizationSlug/medical/purchases/create` — a URL-driven dialog over Medical › Purchases (KICKOFF §4,
D24): New purchase order (`S:57`), prefilled from `?supplier=` or the "Reorder low stock" preset `?reorder=low`. The route renders nothing: the Purchases page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `app-medical` module, then `requireOrgStatus`.

## Files

| File                       | Responsibility                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `create.route.tsx`         | Route marker — exports `Component` rendering `NewPurchaseOrderPage`.                                         |
| `create.manifest.ts`       | Manifest — `kind: 'leaf'`, permission `organization:read`, module `app-medical`, title "New purchase order". |
| `NewPurchaseOrderPage.tsx` | Renders nothing — the drawer mounts on the Purchases page.                                                   |

## Test ids

`purchase-order-drawer` — the drawer the Purchases page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
