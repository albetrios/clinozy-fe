# `pages/organization/$organizationSlug/medical/medicines/create` — New medicine

Route: `/organization/$organizationSlug/medical/medicines/create` — a URL-driven dialog over Medical › Medicines (KICKOFF §4,
D24): New medicine (`S:54`), its name prefilled from `?name=`. The route renders nothing: the Medicines page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `clinic-medical` module, then `requireOrgStatus`.

## Files

| File                  | Responsibility                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| `create.route.tsx`    | Route marker — exports `Component` rendering `NewMedicinePage`.                                           |
| `create.manifest.ts`  | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-medical`, title "New medicine". |
| `NewMedicinePage.tsx` | Renders nothing — the drawer mounts on the Medicines page.                                                |

## Test ids

`medicine-drawer` — the drawer the Medicines page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
