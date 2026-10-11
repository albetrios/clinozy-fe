# `pages/organization/$organizationSlug/stock/purchases/$purchaseId/edit` — Edit purchase

Route: `/organization/$organizationSlug/stock/purchases/$purchaseId/edit` — a URL-driven dialog over Clinic stock › Purchases (KICKOFF §4,
D24): Edit purchase (`S:80`) — a row's click. The route renders nothing: the Purchases page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `app-stock` module, then `requireOrgStatus`; without `stock_item:update`
the drawer opens view only.

The record is `GET /app/stock-purchases/:purchaseId`; a save changes the bill's details only (`PATCH` with
`expected_updated_at` — a `409 record_changed` offers "Reload"), the lines and what is paid stay the server's,
and Delete goes only for an unpaid purchase. See `../../PURCHASES.OVERVIEW.md` › The Purchase drawer.

## Files

| File                        | Responsibility                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `edit.route.tsx`            | Route marker — exports `Component` rendering `EditStockPurchasePage`.                                 |
| `edit.manifest.ts`          | Manifest — `kind: 'leaf'`, permission `organization:read`, module `app-stock`, title "Edit purchase". |
| `EditStockPurchasePage.tsx` | Renders nothing — the drawer mounts on the Purchases page.                                            |

## Test ids

`stock-purchase-drawer` — the drawer the Purchases page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
