# `pages/organization/$organizationSlug/patients/$patientId/payments` — Payments

Route: `/organization/$organizationSlug/patients/$patientId/payments` — a section of the
patient file (KICKOFF §6.6, D26; H:4751; `patient-file.md:34–46`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title, and no "New …" (Record payment comes back with Payments on clinozy-be: Receive payment still reads the fixture patients, D152);
a billing section — it also needs billing view (`S:33`); the section's table (L-43b) on the family's `../shared/components/PatientSectionTable/` — the shared data table with selection and Export, folded columns on a tablet, rows with the key column on a phone, the footer count and "All … loaded", or the section's empty state: Receipt · When · Invoice · Mode · Amount ("+ ₹2,000" sage, "− ₹500" blush) · By, a refund with the blush start bar; a row opens nothing. The receipts are still the fixture world's (`REPLACE_WITH_API`).

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                             | Responsibility                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `payments.route.tsx`             | Route marker — exports `Component` rendering `PatientPaymentsPage`.                                    |
| `payments.manifest.ts`           | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Payments". |
| `PatientPaymentsPage.tsx`        | The section: its Columns chooser and the table of her receipts and refunds.                            |
| `hooks/usePatientPaymentsTable/` | The columns (760px): When the primary, Amount the phone key, the recorder's pill folding to nothing.   |

## Test ids

`patient-section-payments` — the section's root; `patient-payments-table` and its rows (`docs/reference/e2e-testids-inventory.md` › Patient file).
