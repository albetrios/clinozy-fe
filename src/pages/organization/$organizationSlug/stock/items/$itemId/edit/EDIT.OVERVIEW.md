# `pages/organization/$organizationSlug/stock/items/$itemId/edit` — Edit item

Route: `/organization/$organizationSlug/stock/items/$itemId/edit` — a URL-driven dialog over Clinic stock › Items (KICKOFF §4,
D24): Edit item (`S:75`) — a row's click; the row's "Use" is a popover with no URL. The route renders nothing: the Items page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `clinic-stock` module, then `requireOrgStatus`.

## Files

| File                    | Responsibility                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `edit.route.tsx`        | Route marker — exports `Component` rendering `EditStockItemPage`.                                    |
| `edit.manifest.ts`      | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-stock`, title "Edit item". |
| `EditStockItemPage.tsx` | Renders nothing — the drawer mounts on the Items page.                                               |

## Test ids

`stock-item-drawer` — the drawer the Items page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
