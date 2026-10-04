# `pages/organization/$organizationSlug/medical/payments` — Medical › Payments

Route: `/organization/$organizationSlug/medical/payments` (KICKOFF §6.7, L-50). Same gates as the
Medical room. The Payments ledger limited to Medical (`scope=medical`, `S:71`): receipts on
Medical invoices, supplier bills on Medical purchase orders and expenses in Medicines, under the
Medical toolbar ("New sale" its primary). The ledger is the Payments room's (L-39) and mounts here
once it is shared (L-50c); until then the tab shows its empty state.

## Files

| File                      | Responsibility                                                      |
| ------------------------- | ------------------------------------------------------------------- |
| `payments.route.tsx`      | Route marker — exports `Component` rendering `MedicalPaymentsPage`. |
| `payments.manifest.ts`    | Manifest — `kind: 'leaf'`, module `clinic-medical`.                 |
| `MedicalPaymentsPage.tsx` | The tab: the Medical toolbar over the ledger's place.               |

## Test ids

`medical-payments-page`; the shared toolbar ids prefixed `medical-payments`.
