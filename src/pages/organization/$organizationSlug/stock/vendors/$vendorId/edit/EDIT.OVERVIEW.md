# `pages/organization/$organizationSlug/stock/vendors/$vendorId/edit` — Edit clinic vendor

Route: `/organization/$organizationSlug/stock/vendors/$vendorId/edit` — a URL-driven dialog over Clinic stock › Vendors (KICKOFF §4,
D24): Edit clinic vendor (`S:83`) — a row's click. The route renders nothing: the Vendors page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `app-stock` module, then `requireOrgStatus`.

## Files

| File                      | Responsibility                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `edit.route.tsx`          | Route marker — exports `Component` rendering `EditStockVendorPage`.                                        |
| `edit.manifest.ts`        | Manifest — `kind: 'leaf'`, permission `organization:read`, module `app-stock`, title "Edit clinic vendor". |
| `EditStockVendorPage.tsx` | Renders nothing — the drawer mounts on the Vendors page.                                                   |

## Test ids

`stock-vendor-drawer` — the drawer the Vendors page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
