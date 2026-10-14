import type { ReactElement } from 'react';

import type { InvoiceDetail } from '@/shared/api/app/invoices-contracts.ts';
import { InvoicePrint, printDocument } from '@/shared/components/PrintTemplate/index.ts';

/**
 * A saved invoice's A4 sheet (L-22, KICKOFF §6.9 Print), from the invoice as read once
 * (`fetchInvoice`): who it bills — the patient, or a Medical sale's walk-in — its lines and
 * every figure as the server keeps them, the Remark (the one note that prints, §7.3), what is
 * paid and due, and the clinic's own footer with the branch's phone and GSTIN
 * (`GET /app/branches/my`).
 */
export function invoiceSheet(detail: InvoiceDetail): ReactElement {
  return (
    <InvoicePrint
      invoice={detail.invoice}
      sale={detail.sale ?? null}
      party={detail.party}
      organization={detail.sheet.organization}
      branch={detail.sheet.branch}
    />
  );
}

/** Print a saved invoice — the browser's dialog 260ms after the sheet renders (H:4423). */
export function printInvoice(detail: InvoiceDetail): Promise<void> {
  return printDocument(invoiceSheet(detail));
}
