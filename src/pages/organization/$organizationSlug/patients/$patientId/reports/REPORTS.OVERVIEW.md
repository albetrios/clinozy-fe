# `pages/organization/$organizationSlug/patients/$patientId/reports` — Reports

Route: `/organization/$organizationSlug/patients/$patientId/reports` — a section of the
patient file (KICKOFF §6.6, D26; H:4760; `patient-file.md:34–46`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the table lands with L-43b, Upload report and Report view with L-45.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                     | Responsibility                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `reports.route.tsx`      | Route marker — exports `Component` rendering `PatientReportsPage`.                                    |
| `reports.manifest.ts`    | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Reports". |
| `PatientReportsPage.tsx` | The section: `PatientSection` with its header and content.                                            |

## Test ids

`patient-section-reports` — the section's root (`docs/reference/e2e-testids-inventory.md` › Patient file).
