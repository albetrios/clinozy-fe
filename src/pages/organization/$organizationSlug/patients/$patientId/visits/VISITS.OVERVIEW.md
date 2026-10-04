# `pages/organization/$organizationSlug/patients/$patientId/visits` — Visits

Route: `/organization/$organizationSlug/patients/$patientId/visits` — a section of the
patient file (KICKOFF §6.6, D26; H:4746; `patient-file.md:34–46`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the patient's appointments (a prototype-only section, D26) — the table lands with L-43b; "New appointment" opens the appointment form for this patient.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                    | Responsibility                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `visits.route.tsx`      | Route marker — exports `Component` rendering `PatientVisitsPage`.                                    |
| `visits.manifest.ts`    | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Visits". |
| `PatientVisitsPage.tsx` | The section: `PatientSection` with its header and content.                                           |

## Test ids

`patient-section-visits` — the section's root (`docs/reference/e2e-testids-inventory.md` › Patient file).
