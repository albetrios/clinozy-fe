# `pages/organization/$organizationSlug/medical/suppliers/$supplierId/edit` — Edit supplier

Route: `/organization/$organizationSlug/medical/suppliers/$supplierId/edit` — a URL-driven dialog over Medical › Suppliers (KICKOFF §4,
D24): Edit supplier (`S:63`), with its Account. The route renders nothing: the Suppliers page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `app-medical` module, then `requireOrgStatus`.

## Files

| File                   | Responsibility                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `edit.route.tsx`       | Route marker — exports `Component` rendering `EditSupplierPage`.                                        |
| `edit.manifest.ts`     | Manifest — `kind: 'leaf'`, permission `organization:read`, module `app-medical`, title "Edit supplier". |
| `EditSupplierPage.tsx` | Renders nothing — the drawer mounts on the Suppliers page.                                              |

## Test ids

`supplier-drawer` — the drawer the Suppliers page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
