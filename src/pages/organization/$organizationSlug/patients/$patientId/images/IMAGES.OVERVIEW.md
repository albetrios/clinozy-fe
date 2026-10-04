# `pages/organization/$organizationSlug/patients/$patientId/images` — Photos

Route: `/organization/$organizationSlug/patients/$patientId/images` — a section of the
patient file (KICKOFF §6.6, D26; H:827–832; `patient-file.md:59–68`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the albums, the photo grid, uploads, the viewer and Photo details land with L-44; "Upload images" needs Patients create.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                    | Responsibility                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `images.route.tsx`      | Route marker — exports `Component` rendering `PatientImagesPage`.                                    |
| `images.manifest.ts`    | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Photos". |
| `PatientImagesPage.tsx` | The section: `PatientSection` with its header and content.                                           |

## Test ids

`patient-section-images` — the section's root (`docs/reference/e2e-testids-inventory.md` › Patient file).
