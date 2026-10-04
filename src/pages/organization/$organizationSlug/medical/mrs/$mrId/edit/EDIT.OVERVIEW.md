# `pages/organization/$organizationSlug/medical/mrs/$mrId/edit` — Edit MR

Route: `/organization/$organizationSlug/medical/mrs/$mrId/edit` — a URL-driven dialog over Medical › MRs (KICKOFF §4,
D24): Edit MR (`S:69`). The route renders nothing: the MRs page reads the URL and opens the
drawer over the list, so a refresh or a shared link reopens it; an unknown id leaves the list
in place with "<Record> not found" (`S:115`). Gated like the room — membership
(`organization:read`) and the `clinic-medical` module, then `requireOrgStatus`.

## Files

| File               | Responsibility                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| `edit.route.tsx`   | Route marker — exports `Component` rendering `EditMrPage`.                                           |
| `edit.manifest.ts` | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-medical`, title "Edit MR". |
| `EditMrPage.tsx`   | Renders nothing — the drawer mounts on the MRs page.                                                 |

## Test ids

`mr-drawer` — the drawer the MRs page opens for this URL; the route renders no element
of its own (`tooling/validate/test-ids-allowlist.txt`).
