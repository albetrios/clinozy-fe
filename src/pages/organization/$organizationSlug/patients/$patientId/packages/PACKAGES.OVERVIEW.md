# `pages/organization/$organizationSlug/patients/$patientId/packages` — Packages

Route: `/organization/$organizationSlug/patients/$patientId/packages` — a section of the
patient file (KICKOFF §6.6, D26; H:833; `patient-file.md:70–79`). It renders in the file layout's
content column through the family's section frame (`../shared/components/PatientSection/`) — its
title, and no "New …": a package is bought only by invoicing it (G4).

Data: clinozy-be (api-integration §5.4). The cards are `usePatientPackages(patientId)`
(`GET /app/patients/:patient_id/offerings?is_package=true`, every page): the name in the
offering's tone (the offerings catalogue, `usePlanOfferings`, shared with the plan card), "6 left"
over "1 of 7 used", the bar, "Valid till …" (or "No expiry") with "Used up" / "Expired" — every
figure and the status the server's (`sessions_left`, `sessions_used`, `status`; §7); then "Book
next" (Appointments create — the appointment form for this person, `who=` their contact) and
"Edit" (`payment:update`). Loading shows two card outlines, a failed read Retry, none "No
packages yet".

Edit opens **Edit package** as component state — no route (D24): "Valid till" (a date, or none)
and "Sessions" (from what was used up to 999), `PATCH …/offerings/:patient_offering_id` with the
changed fields and `expected_updated_at`; the server's field errors land on their fields, a stale
save toasts with "Reload". Gone from the design: "Use a session" (a recorded treatment spends one,
§6 #20), "Add package" and its drawer (no package before its invoice, G4), "Next: <date>" per
package (G4).

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                            | Responsibility                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `packages.route.tsx`            | Route marker — exports `Component` rendering `PatientPackagesPage`.                                    |
| `packages.manifest.ts`          | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Packages". |
| `packages.constants.ts`         | The cards' and Edit package's copy keys and test ids.                                                  |
| `PatientPackagesPage.tsx`       | The section: its cards and their states, and Edit package while it is open.                            |
| `components/EditPackageDrawer/` | Edit package (560): "Valid till" and "Sessions" over the package's name; "Package saved".              |

## Test ids

`patient-section-packages` — the section's root; `patient-package-<id>` (`data-status`) with its
`-book` and `-edit`; `package-drawer` with `package-drawer-valid-until` and
`package-drawer-sessions` (`docs/reference/e2e-testids-inventory.md` › Patient file records).
