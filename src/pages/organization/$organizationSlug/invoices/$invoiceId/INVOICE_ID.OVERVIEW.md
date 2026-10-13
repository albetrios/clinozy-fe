# `pages/organization/$organizationSlug/invoices/$invoiceId` — an invoice's preview

Route: `/organization/$organizationSlug/invoices/$invoiceId` (`S:93`) — a URL-driven dialog over
its referrer (KICKOFF §4, D24). The route renders nothing but its outlet: the invoices island
reads the URL, reads the invoice once (`GET /app/invoices/{invoice_id}`) and opens the shared
`PrintPreview` — "Print preview · Invoice #6", Close, "Print / Save PDF" — on its A4 sheet: the
statutory number ("2026-27/0006"), each line as the server priced it, the taxable amount, GST,
bill and balance due, the Remark printed on it (§7.3), the clinic's name and the branch's phone
and GSTIN. An invoice that is gone goes back with "Invoice not found · it may have been deleted"
(`S:115`). Its child is the invoice's edit.

## Files

| File                     | Responsibility                                                        |
| ------------------------ | --------------------------------------------------------------------- |
| `invoice-id.route.tsx`   | Route marker — exports `Component` rendering `InvoicePreviewPage`.    |
| `invoice-id.manifest.ts` | Manifest — `kind: 'layout'`, child `edit`, test id `invoice-preview`. |
| `InvoicePreviewPage.tsx` | Renders the outlet only — the preview opens on the island's host.     |

## Test ids

`invoice-preview`, `invoice-preview-close`, `invoice-preview-print` — rendered by the island's
host, listed in `docs/reference/e2e-testids-inventory.md`.
