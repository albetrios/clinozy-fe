# `pages/organization/$organizationSlug/patients/$patientId/invoices` — Invoices

Route: `/organization/$organizationSlug/patients/$patientId/invoices` — a section of the
patient file (KICKOFF §6.6, D26; H:4748; `patient-file.md:34–46`) on clinozy-be. It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title and the split "New invoice" (the Add-to-record Invoice item, `payment:create`: the shared Invoice drawer for this patient over the section);
a billing section — it also needs billing view (`S:33`); the section's table (L-43b) on the family's `../shared/components/PatientSectionTable/` — the shared data table with selection and Export (`payment:export`), folded columns on a tablet, rows with the key column on a phone, the next page of 50 as it scrolls, the footer count and "All … loaded", or the section's empty state: Invoice ("#787" and its type) · Items (the billed names over the remark) · Team (hidden) · Bill · Paid / due · Status · Date with the status's start bar — every figure the server's, in rupees (`total`, `paid_amount`, `due_amount`, `payment_status`).

Reads: `GET /app/invoices?patient_id=` (`useInvoiceList`, newest first, 50 a page) and the footer's "2 invoices · ₹4,800 due" from one `GET /app/invoices?patient_id=&limit=1` (`useInvoiceTotals`: `meta.due_total`, `pagination.estimated_total` — never summed from the rows). A failed first read says so in place with Retry.

A row opens Edit invoice on the shared Invoice drawer (L-40) by its public id — the preview for a member without `payment:update`, for a Medical sale's invoice and for a settled one (`is_settled`) — keeping the file behind it (`from`, A-P1). Its actions, each on its code (`usePaymentAccess`): Print and Preview; Copy invoice (`payment:create`, never a sale's: New invoice prefilled from it, today, nothing paid; "Copied as #788" on save; L-64); Record payment (`payment:create`, while the server says it owes: Receive payment for this invoice over the file); Edit (`payment:update`) and Delete (`payment:delete`, "Delete this invoice?" with its reason and Undo; `409 invoice_paid` / `offering_in_use` in the drawer's words), neither on a sale's invoice nor a settled one.

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is the member's `payment:*` codes (`usePaymentAccess`; a View-as preview reads the role's Payments matrix). Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                          | Responsibility                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `invoices.route.tsx`          | Route marker — exports `Component` rendering `PatientInvoicesPage`.                                                  |
| `invoices.manifest.ts`        | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Invoices".               |
| `PatientInvoicesPage.tsx`     | The section: its Columns chooser, the paged table, the server's count line, Retry, and "Delete this invoice?".       |
| `hooks/useInvoicesTable/`     | The columns (1120px): Items the primary, Bill the phone key, Paid / due over "₹4,800 due" or "Nothing due" (rupees). |
| `hooks/useInvoiceRowActions/` | A row's actions and what a row opens, on the ⌘K invoice targets with `from`, each gated by its `payment:*` code.     |

## Test ids

`patient-section-invoices` — the section's root; `patient-invoices-table`, its rows and `patient-invoices-row-action-<print|preview|copy|pay|edit|delete>`; `retry-button` when the first read failed (`docs/reference/e2e-testids-inventory.md` › Patient file).
