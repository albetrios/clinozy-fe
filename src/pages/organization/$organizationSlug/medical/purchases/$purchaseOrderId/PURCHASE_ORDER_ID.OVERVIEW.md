# `pages/organization/$organizationSlug/medical/purchases/$purchaseOrderId` — Purchase order

Route: `/organization/$organizationSlug/medical/purchases/$purchaseOrderId` — a URL-driven dialog over Medical › Purchases (KICKOFF §4,
D24): the read-only Purchase order view (`S:58`) of a received or paid order — a paid one prints its A4 purchase order (L-64, Q-M7). The route renders nothing: the Purchases page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `app-medical` module, then `requireOrgStatus`.

## Files

| File                            | Responsibility                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `purchase-order-id.route.tsx`   | Route marker — exports `Component` rendering `PurchaseOrderPage`.                                          |
| `purchase-order-id.manifest.ts` | Manifest — `kind: 'layout'`, permission `organization:read`, module `app-medical`, title "Purchase order". |
| `PurchaseOrderPage.tsx`         | Renders its child routes only (`<Outlet />`) — the drawer mounts on the Purchases page.                    |

## Test ids

`purchase-order-view-drawer` — the drawer the Purchases page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
