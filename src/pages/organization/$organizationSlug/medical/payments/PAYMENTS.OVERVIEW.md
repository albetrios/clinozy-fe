# `pages/organization/$organizationSlug/medical/payments` — Medical › Payments

Route: `/organization/$organizationSlug/medical/payments` (KICKOFF §6.7, L-50). Same gates as the
Medical room. The store's slice of the ledger on clinozy-be (`GET /app/medical-payments`, MD31):
receipts and refunds on its sales, supplier bills of its orders, `medicines` expenses and their
reversals, under the Medical toolbar ("New sale" its primary) — the Payments room's ledger units,
shared since L-50c (`src/shared/components/LedgerCells/`, `src/shared/hooks/useLedgerTable/`,
`src/shared/hooks/useLedgerRowActions/`, `src/shared/components/PaymentDeleteConfirm/`,
`src/shared/components/PaymentReverseConfirm/`). Filters: What · Mode · Created, the search — in
the URL (`validateMedicalPaymentsSearch`); no "Show". The store manages its money here (D89): an
open day's entry opens in Payments (`/payments/$paymentId/edit`, over the Payments ledger — a
standing deviation, `S:87`) and offers Edit and Delete with Undo; a closed day's answers "PAY-5501 ·
Day closed" and offers Reverse. Export (`medicine:export`) saves the server's CSV of every payment
the filters match (`GET /app/medical-payments/exports`), warning when it stops at 10,000.

## Files

| File                      | Responsibility                                                      |
| ------------------------- | ------------------------------------------------------------------- |
| `payments.route.tsx`      | Route marker — exports `Component` rendering `MedicalPaymentsPage`. |
| `payments.manifest.ts`    | Manifest — `kind: 'leaf'`, module `app-medical`.                    |
| `MedicalPaymentsPage.tsx` | The tab: the Medical toolbar over the ledger limited to Medical.    |

## Test ids

`medical-payments-page`; the shared toolbar and table ids prefixed `medical-payments`.
