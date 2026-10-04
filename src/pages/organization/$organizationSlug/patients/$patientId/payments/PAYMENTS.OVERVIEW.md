# `pages/organization/$organizationSlug/patients/$patientId/payments` — Payments

Route: `/organization/$organizationSlug/patients/$patientId/payments` — a section of the
patient file (KICKOFF §6.6, D26; H:4751; `patient-file.md:34–46`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and, when the member may add one, the split "New …" + "⌄";
a billing section — it also needs billing view (`S:33`); the table lands with L-43b, "Record payment" opens Receive payment for the open invoices, or says nothing is due.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                      | Responsibility                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `payments.route.tsx`      | Route marker — exports `Component` rendering `PatientPaymentsPage`.                                    |
| `payments.manifest.ts`    | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Payments". |
| `PatientPaymentsPage.tsx` | The section: `PatientSection` with its header and content.                                             |

## Test ids

`patient-section-payments` — the section's root (`docs/reference/e2e-testids-inventory.md` › Patient file).
