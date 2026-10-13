# `pages/organization/$organizationSlug/medical/mrs/create` — New MR

Route: `/organization/$organizationSlug/medical/mrs/create` — a URL-driven dialog over Medical › MRs (KICKOFF §4,
D24): New MR (`S:68`). The route renders nothing: the MRs page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `app-medical` module, then `requireOrgStatus`.

## Files

| File                 | Responsibility                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `create.route.tsx`   | Route marker — exports `Component` rendering `NewMrPage`.                                        |
| `create.manifest.ts` | Manifest — `kind: 'leaf'`, permission `organization:read`, module `app-medical`, title "New MR". |
| `NewMrPage.tsx`      | Renders nothing — the drawer mounts on the MRs page.                                             |

## Test ids

`rep-drawer` — the drawer the MRs page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
