# `pages/organization/$organizationSlug/patients/$patientId/invoices` — Invoices

Route: `/organization/$organizationSlug/patients/$patientId/invoices` — a section of the
patient file (KICKOFF §6.6, D26; H:4748; `patient-file.md:34–46`). It renders in the file layout's content
column through the family's section frame (`../shared/components/PatientSection/`) — its title, and no "New …" (New invoice comes back with Payments on clinozy-be: the drawer still reads the fixture patients, D152);
a billing section — it also needs billing view (`S:33`); the section's table (L-43b) on the family's `../shared/components/PatientSectionTable/` — the shared data table with selection and Export, folded columns on a tablet, rows with the key column on a phone, the footer count and "All … loaded", or the section's empty state: Invoice ("#787" and its type) · Items · Team (hidden) · Bill · Paid / due · Status · Date with the status's start bar, "2 invoices · ₹4,800 due". A row opens Edit invoice on the shared Invoice drawer (L-40) — the preview without billing edit — keeping the file behind it (`from`); Print, Preview, Copy invoice (New invoice prefilled from it: its lines, discount, team and remark, today, nothing paid; "Copied as #788" on save; L-64), Record payment (while it owes), Edit and Delete (the `void` ability; never a sale's invoice). The invoices are still the fixture world's (`REPLACE_WITH_API`).

Gated by the file layout (membership, the `clinic-patients` module, the org status); in-room
access is `useClinicAccess`. Registered in `src/app/routes/routeTree.tsx` through the file's
one lazy module (`../patient-id.sections.ts`).

## Files

| File                          | Responsibility                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `invoices.route.tsx`          | Route marker — exports `Component` rendering `PatientInvoicesPage`.                                         |
| `invoices.manifest.ts`        | Manifest — `kind: 'leaf'`, permission `organization:read`, module `clinic-patients`, title "Invoices".      |
| `PatientInvoicesPage.tsx`     | The section: its Columns chooser, the table and the drawer's "Delete this invoice?".                        |
| `hooks/useInvoicesTable/`     | The columns (1120px): Items the primary, Bill the phone key, Paid / due over "₹4,800 due" or "Nothing due". |
| `hooks/useInvoiceRowActions/` | A row's actions and what a row opens, on the ⌘K invoice targets with `from`.                                |

## Test ids

`patient-section-invoices` — the section's root; `patient-invoices-table`, its rows and `patient-invoices-row-action-<id>` (`docs/reference/e2e-testids-inventory.md` › Patient file).
