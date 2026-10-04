# `pages/organization/$organizationSlug/patients/$patientId/prescriptions` — Prescriptions

Route: `/organization/$organizationSlug/patients/$patientId/prescriptions` — a section of the
patient file (KICKOFF §6.6, D26; H:4753; `patient-file.md:34–46`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the table lands with L-43b, the prescription drawers and the print preview with L-45; "New prescription" is the Doctor and Admin gate (`S:35`).

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                           | Responsibility                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `prescriptions.route.tsx`      | Route marker — exports `Component` rendering `PatientPrescriptionsPage`.                                    |
| `prescriptions.manifest.ts`    | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Prescriptions". |
| `PatientPrescriptionsPage.tsx` | The section: `PatientSection` with its header and content.                                                  |

## Test ids

`patient-section-prescriptions` — the section's root (`docs/reference/e2e-testids-inventory.md` › Patient file).
