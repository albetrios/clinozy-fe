# `pages/organization/$organizationSlug/medical/sales/$saleId` — Sale

Route: `/organization/$organizationSlug/medical/sales/$saleId` — a URL-driven dialog over Medical › Sales (KICKOFF §4,
D24): the read-only Sale drawer (`S:51`) — a sale is changed by a return, never edited. The route renders nothing: the Sales page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `clinic-medical` module, then `requireOrgStatus`.

## Files

| File                  | Responsibility                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `sale-id.route.tsx`   | Route marker — exports `Component` rendering `SalePage`.                                            |
| `sale-id.manifest.ts` | Manifest — `kind: 'layout'`, permission `organization:read`, module `clinic-medical`, title "Sale". |
| `SalePage.tsx`        | Renders its child routes only (`<Outlet />`) — the drawer mounts on the Sales page.                 |

## Test ids

`sale-drawer` — the drawer the Sales page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
