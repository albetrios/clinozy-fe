# `pages/organization/$organizationSlug/patients/$patientId/treatments/create` — New treatment

Route: `/organization/$organizationSlug/patients/$patientId/treatments/create` (`S:38`; KICKOFF §6.6 Drawers, D24) — New treatment — the 680px Treatment drawer over Treatments.

A URL-driven dialog: the route renders nothing; the section page reads the URL (`../../shared/hooks/usePatientRecordRoute/`) and opens `TreatmentDrawer` (`../components/TreatmentDrawer/`) over itself. Recording a treatment is `patient_treatment:create` (a View-as preview: Doctor, Therapist, the Owner); anyone else who follows the link lands back on Treatments with the permission toast. A session for a package spends one of its sessions (`patient_offering_id`; the server numbers it).
Registered in `src/app/routes/routeTree.tsx` under the treatments route, through the file's one
lazy module (`../../patient-id.sections.ts`).

## Files

| File                   | Responsibility                                                   |
| ---------------------- | ---------------------------------------------------------------- |
| `create.route.tsx`     | Route marker — exports `Component` rendering `NewTreatmentPage`. |
| `create.manifest.ts`   | Manifest — `kind: 'leaf'`, test id `treatment-drawer`.           |
| `NewTreatmentPage.tsx` | Renders nothing — the section opens the dialog.                  |

## Test ids

`treatment-drawer` — the dialog the section opens (`docs/reference/e2e-testids-inventory.md` › Patient file).
