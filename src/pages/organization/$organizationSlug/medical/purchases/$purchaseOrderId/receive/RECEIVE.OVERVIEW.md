# `pages/organization/$organizationSlug/medical/purchases/$purchaseOrderId/receive` — Receive goods

Route: `/organization/$organizationSlug/medical/purchases/$purchaseOrderId/receive` — a URL-driven dialog over Medical › Purchases (KICKOFF §4,
D24): Receive goods (`S:60`): tick what arrived, with each batch and expiry, and add what came that was not ordered ("+ Add unexpected item", L-64). The route renders nothing: the Purchases page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `clinic-medical` module, then `requireOrgStatus`.

## Files

| File                   | Responsibility                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `receive.route.tsx`    | Route marker — exports `Component` rendering `ReceiveGoodsPage`.                                           |
| `receive.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-medical`, title "Receive goods". |
| `ReceiveGoodsPage.tsx` | Renders nothing — the drawer mounts on the Purchases page.                                                 |

## Test ids

`receive-goods-drawer` — the drawer the Purchases page opens for this URL (`-lines-add` is "+ Add
unexpected item"); the route renders no element of its own (`tooling/validate/test-ids-allowlist.txt`).
