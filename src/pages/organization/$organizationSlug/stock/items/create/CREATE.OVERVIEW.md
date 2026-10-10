# `pages/organization/$organizationSlug/stock/items/create` — New item

Route: `/organization/$organizationSlug/stock/items/create` — a URL-driven dialog over Clinic stock › Items (KICKOFF §4,
D24): New item (`S:74`): a consumable or piece of equipment, its levels and its vendor. The route renders nothing: the Items page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `clinic-stock` module, then `requireOrgStatus`; the drawer opens with
`stock_item:create`.

On clinozy-be the save is `POST /app/stock-items`, In stock its `opening_quantity` (an `opening`
movement); a name another item has (`409 record_already_exists`, any case) goes on Name, the API's
field errors on their fields.

## Files

| File                   | Responsibility                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `create.route.tsx`     | Route marker — exports `Component` rendering `NewStockItemPage`.                                    |
| `create.manifest.ts`   | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-stock`, title "New item". |
| `NewStockItemPage.tsx` | Renders nothing — the drawer mounts on the Items page.                                              |

## Test ids

`stock-item-drawer` — the drawer the Items page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
