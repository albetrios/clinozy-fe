# `pages/organization/$organizationSlug/patients/$patientId/packages` — Packages

Route: `/organization/$organizationSlug/patients/$patientId/packages` — a section of the
patient file (KICKOFF §6.6, D26; H:833; `patient-file.md:70–79`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the package cards land with L-43b, the Add package drawer with L-45.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                      | Responsibility                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `packages.route.tsx`      | Route marker — exports `Component` rendering `PatientPackagesPage`.                                    |
| `packages.manifest.ts`    | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Packages". |
| `PatientPackagesPage.tsx` | The section: `PatientSection` with its header and content.                                             |

## Test ids

`patient-section-packages` — the section's root (`docs/reference/e2e-testids-inventory.md` › Patient file).
