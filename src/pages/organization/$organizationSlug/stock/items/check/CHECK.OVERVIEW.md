# `pages/organization/$organizationSlug/stock/items/check` — Stock check

Route: `/organization/$organizationSlug/stock/items/check` — a URL-driven dialog over Clinic stock › Items (KICKOFF §4,
D24): Stock check (`S:76`): type what is on the shelf; only the items that differ are saved, each as an Adjust entry. The route renders nothing: the Items page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `clinic-stock` module, then `requireOrgStatus`; the drawer opens with
`stock_item:update`.

On clinozy-be the list is the whole item list (every page of `GET /app/stock-items`, bars while it loads,
Retry in place when it fails, a line when there is nothing to count); "Save count" sends the differing
counts only (`POST /app/stock-counts`, each an Adjust noted "Stock check") and says the server's
`changed_item_count`.

## Files

| File                 | Responsibility                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `check.route.tsx`    | Route marker — exports `Component` rendering `StockCheckPage`.                                         |
| `check.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-stock`, title "Stock check". |
| `StockCheckPage.tsx` | Renders nothing — the drawer mounts on the Items page.                                                 |

## Test ids

`stock-check-drawer` — the drawer the Items page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
