# `pages/organization/$organizationSlug/stock/purchases/create` — New purchase

Route: `/organization/$organizationSlug/stock/purchases/create` — a URL-driven dialog over Clinic stock › Purchases (KICKOFF §4,
D24): New purchase (`S:79`), with "Reorder low items" preset by `?reorder=low`. The route renders nothing: the Purchases page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `clinic-stock` module, then `requireOrgStatus`.

## Files

| File                       | Responsibility                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `create.route.tsx`         | Route marker — exports `Component` rendering `NewStockPurchasePage`.                                    |
| `create.manifest.ts`       | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-stock`, title "New purchase". |
| `NewStockPurchasePage.tsx` | Renders nothing — the drawer mounts on the Purchases page.                                              |

## Test ids

`stock-purchase-drawer` — the drawer the Purchases page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
