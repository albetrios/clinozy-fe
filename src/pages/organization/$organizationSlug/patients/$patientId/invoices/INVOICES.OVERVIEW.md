# `pages/organization/$organizationSlug/patients/$patientId/invoices` — Invoices

Route: `/organization/$organizationSlug/patients/$patientId/invoices` — a section of the
patient file (KICKOFF §6.6, D26; H:4748; `patient-file.md:34–46`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
a billing section — it also needs billing view (`S:33`); the table lands with L-43b, "New invoice" opens the shared Invoice drawer (L-40) keeping the file behind it.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                      | Responsibility                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `invoices.route.tsx`      | Route marker — exports `Component` rendering `PatientInvoicesPage`.                                    |
| `invoices.manifest.ts`    | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Invoices". |
| `PatientInvoicesPage.tsx` | The section: `PatientSection` with its header and content.                                             |

## Test ids

`patient-section-invoices` — the section's root (`docs/reference/e2e-testids-inventory.md` › Patient file).
