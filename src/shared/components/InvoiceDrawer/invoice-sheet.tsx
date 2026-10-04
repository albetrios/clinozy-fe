import type { ReactElement } from 'react';

import type { InvoiceDetail } from '@/shared/api/clinic/invoices-contracts.ts';
import { InvoicePrint, printDocument } from '@/shared/components/PrintTemplate/index.ts';

/**
 * A saved invoice's A4 sheet (L-22, KICKOFF §6.9 Print): the patient — or a
 * Medical sale's walk-in customer, with the sale's number — its lines, the
 * Remark (the one note that prints, §7.3), the payment summary from the
 * ledger, and the clinic's own footer.
 */
export function invoiceSheet(detail: InvoiceDetail): ReactElement {
  const { party } = detail;
  return (
    <InvoicePrint
      invoice={detail.invoice}
      sale={detail.sale}
      payments={detail.payments}
      patient={
        party?.kind === 'patient'
          ? { firstName: party.firstName, lastName: party.lastName, phone: party.phone }
          : null
      }
      contact={
        party?.kind === 'contact' ? { name: party.name, phone: party.phone } : null
      }
      organization={detail.sheet.organization}
      branch={detail.sheet.branch}
    />
  );
}

/** Print a saved invoice — the browser's dialog 260ms after the sheet renders (H:4423). */
export function printInvoice(detail: InvoiceDetail): Promise<void> {
  return printDocument(invoiceSheet(detail));
}
