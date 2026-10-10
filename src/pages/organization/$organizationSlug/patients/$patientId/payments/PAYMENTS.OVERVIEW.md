# `pages/organization/$organizationSlug/patients/$patientId/payments` — Payments

Route: `/organization/$organizationSlug/patients/$patientId/payments` — a section of the
patient file (KICKOFF §6.6, D26; H:4751; `patient-file.md:34–46`) on clinozy-be. It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and the split "Record payment" (the Add-to-record Payment item, `payment:create`: Receive payment for this patient over the section, or "Nothing due for …" when the server says she owes nothing);
a billing section — it also needs billing view (`S:33`); the section's table (L-43b) on the family's `../shared/components/PatientSectionTable/` — the shared data table with selection and Export (`payment:export`), folded columns on a tablet, rows with the key column on a phone, the footer count and "All … loaded", or the section's empty state: Receipt · When · Invoice · Mode · Amount ("+ ₹2,000" sage, "− ₹500" blush — rupees as the API sends them) · By (who recorded it, from the team), money out with the blush start bar.

Reads: the ledger's entries for her person — `GET /app/payments?patient_id=` (the API filters by the patient's contact, every page; `usePatientPayments`): receipts, refunds, a credit's money and reversals, newest first. A failed read says so in place with Retry.

A row opens nothing. Its actions are the ledger's (`useLedgerRowActions`), by the entry's public id: on an open day Edit (`payment:update`; a receipt — a refund's and a reversal's money is fixed) opens the entry's drawer over the file (`/payments/$paymentId/edit?from=…`, the `paymentEdit` cross-room drawer, A-P1) and Delete (`payment:delete`, `PaymentDeleteConfirm`, Undo); on a closed day Reverse (`payment:delete`, `PaymentReverseConfirm`; `409 already_reversed` / `day_open` / `day_closed` in the ledger's words), never on a reversal or an entry already reversed; a pending credit's entry offers nothing. The section's chunk loads the Payments room's copy with it.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is the member's `payment:*` codes (`usePaymentAccess`). Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                             | Responsibility                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `payments.route.tsx`             | Route marker — exports `Component` rendering `PatientPaymentsPage`.                                             |
| `payments.manifest.ts`           | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Payments".          |
| `PatientPaymentsPage.tsx`        | The section: its Columns chooser, the table of her entries, Retry, the ledger's row actions and their confirms. |
| `hooks/usePatientPaymentsTable/` | The columns (760px): When the primary, Amount the phone key (rupees), the recorder's pill folding to nothing.   |

## Test ids

`patient-section-payments` — the section's root; `patient-payments-table`, its rows and `patient-payments-row-action-<edit|delete|reverse>`; `retry-button` when the read failed (`docs/reference/e2e-testids-inventory.md` › Patient file).
