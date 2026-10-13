# `pages/organization/$organizationSlug/medical/suppliers/create` — New supplier

Route: `/organization/$organizationSlug/medical/suppliers/create` — a URL-driven dialog over Medical › Suppliers (KICKOFF §4,
D24): New supplier (`S:62`). The route renders nothing: the Suppliers page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `app-medical` module, then `requireOrgStatus`.

## Files

| File                  | Responsibility                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `create.route.tsx`    | Route marker — exports `Component` rendering `NewSupplierPage`.                                        |
| `create.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `app-medical`, title "New supplier". |
| `NewSupplierPage.tsx` | Renders nothing — the drawer mounts on the Suppliers page.                                             |

## Test ids

`supplier-drawer` — the drawer the Suppliers page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
