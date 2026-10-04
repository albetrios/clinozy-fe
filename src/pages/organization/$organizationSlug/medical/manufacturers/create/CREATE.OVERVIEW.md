# `pages/organization/$organizationSlug/medical/manufacturers/create` — New manufacturer

Route: `/organization/$organizationSlug/medical/manufacturers/create` — a URL-driven dialog over Medical › Manufacturers (KICKOFF §4,
D24): New manufacturer (`S:65`). The route renders nothing: the Manufacturers page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `clinic-medical` module, then `requireOrgStatus`.

## Files

| File                      | Responsibility                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `create.route.tsx`        | Route marker — exports `Component` rendering `NewManufacturerPage`.                                           |
| `create.manifest.ts`      | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-medical`, title "New manufacturer". |
| `NewManufacturerPage.tsx` | Renders nothing — the drawer mounts on the Manufacturers page.                                                |

## Test ids

`manufacturer-drawer` — the drawer the Manufacturers page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
