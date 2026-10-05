# `pages/organization/$organizationSlug/patients/$patientId/packages` — Packages

Route: `/organization/$organizationSlug/patients/$patientId/packages` — a section of the
patient file (KICKOFF §6.6, D26; H:833; `patient-file.md:70–79`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
the package cards (L-43b; `repeat(auto-fill, minmax(280px, 1fr))`): the name in the offering's tone, "6 left" over "1 of 7 used", the bar, "Valid till … · Next: …", then "Use a session" (Patients edit, `../shared/hooks/usePackageSession/` — the Overview's "Use session" too; the contract counts sessions only through treatments, a backend request) and "Book next" (the appointment form for her); "No packages yet". Its own primary, "Add package" (Patients create), opens the Add
package drawer as component state — no route (D24): the contract makes packages only by
invoicing (AMBER A-F6), so one added here has no invoice yet (`invoiceId` null — an Appendix F
request, `src/shared/api/clinic/patient-packages-contracts.ts`).

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                           | Responsibility                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages.route.tsx`           | Route marker — exports `Component` rendering `PatientPackagesPage`.                                                                                                             |
| `packages.manifest.ts`         | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Packages".                                                                          |
| `packages.constants.ts`        | Add package's and the cards' copy keys and test ids.                                                                                                                            |
| `PatientPackagesPage.tsx`      | The section: its cards, its "Add package" primary, and the drawer while it is open.                                                                                             |
| `components/AddPackageDrawer/` | Add package (560): one titled group "Pick a package" — the multi-session offerings as chips, no step card; none → "Pick a package"; "Package added · invoice it from Invoices". |

## Test ids

`patient-section-packages` — the section's root; `patient-package-<id>` with its `-use` and `-book`; `package-drawer` and its parts
(`docs/reference/e2e-testids-inventory.md` › Patient file records).
