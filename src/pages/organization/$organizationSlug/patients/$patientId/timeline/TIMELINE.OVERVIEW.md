# `pages/organization/$organizationSlug/patients/$patientId/timeline` — Overview

Route: `/organization/$organizationSlug/patients/$patientId/timeline` — a section of the
patient file (KICKOFF §6.6, D26; H:769–779, H:4980–4999). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — no header on the Overview;
the default section (D19): the bento, the activity timeline and the smart note land with L-46; the visit flow on `?visit=open` with the Visit model (L-49, D18). It has no section header (H:4943).

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                      | Responsibility                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `timeline.route.tsx`      | Route marker — exports `Component` rendering `PatientTimelinePage`.                                    |
| `timeline.manifest.ts`    | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Overview". |
| `PatientTimelinePage.tsx` | The section: `PatientSection` with its header and content.                                             |

## Test ids

`patient-section-timeline` — the section's root (`docs/reference/e2e-testids-inventory.md` › Patient file).
