# `pages/organization/$organizationSlug/patients/$patientId/overview` — Clinical notes

Route: `/organization/$organizationSlug/patients/$patientId/overview` — a section of the
patient file (KICKOFF §6.6, D26; H:780–826; `patient-file.md:48–57`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the four chip cards, Offering suggestions and Feedback land with L-43; the check-in and review drawers open over it.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                      | Responsibility                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `overview.route.tsx`      | Route marker — exports `Component` rendering `PatientOverviewPage`.                                          |
| `overview.manifest.ts`    | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Clinical notes". |
| `PatientOverviewPage.tsx` | The section: `PatientSection` with its header and content.                                                   |

## Test ids

`patient-section-overview` — the section's root (`docs/reference/e2e-testids-inventory.md` › Patient file).
