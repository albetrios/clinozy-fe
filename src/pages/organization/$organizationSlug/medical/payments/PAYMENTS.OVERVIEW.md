# `pages/organization/$organizationSlug/medical/payments` — Medical › Payments

Route: `/organization/$organizationSlug/medical/payments` (KICKOFF §6.7, L-50). Same gates as the
Medical room. The Payments ledger limited to Medical (`scope=medical`, `S:71`): receipts on
Medical invoices, supplier bills on Medical purchase orders and expenses in Medicines, under the
Medical toolbar ("New sale" its primary) — the Payments room's ledger units, shared since L-50c
(`src/shared/components/LedgerCells/`, `src/shared/hooks/useLedgerTable/`,
`src/shared/hooks/useLedgerRowActions/`, `src/shared/components/PaymentDeleteConfirm/`), on
`scope=medical`. Filters: What · Mode · Created, the search — in the URL
(`validateMedicalPaymentsSearch`); no "Show". An open day's entry opens in Payments
(`/payments/$paymentId/edit`, over the Payments ledger — a standing deviation, `S:87`) and offers
Edit and Delete; a closed day's answers "PAY-5501 · Day closed".

## Files

| File                      | Responsibility                                                      |
| ------------------------- | ------------------------------------------------------------------- |
| `payments.route.tsx`      | Route marker — exports `Component` rendering `MedicalPaymentsPage`. |
| `payments.manifest.ts`    | Manifest — `kind: 'leaf'`, module `app-medical`.                    |
| `MedicalPaymentsPage.tsx` | The tab: the Medical toolbar over the ledger limited to Medical.    |

## Test ids

`medical-payments-page`; the shared toolbar and table ids prefixed `medical-payments`.
