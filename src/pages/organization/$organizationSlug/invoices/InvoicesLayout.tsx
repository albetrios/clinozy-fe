import { useTranslation } from 'react-i18next';

import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
  INVOICE_DRAWER_TEST_IDS,
  InvoiceDrawer,
  invoiceSheet,
} from '@/shared/components/InvoiceDrawer/index.ts';
import { PrintPreview } from '@/shared/components/PrintPreview/index.ts';

import { useInvoicesDialogRoute } from './hooks/useInvoicesDialogRoute/index.ts';

/**
 * The invoices island (KICKOFF §4, §6.9; `S:92–94`): it has no page of its
 * own — its routes are dialogs over a referrer, the Payments ledger standing
 * behind them (`routeTree.tsx` renders the ledger beside this host, and the
 * ledger's outlet holds the dialog routes, which render nothing). It reads
 * the URL and opens New invoice (`create/`, on `?type=&patient=`), an
 * invoice's preview with Print (`$invoiceId/`) or Edit invoice
 * (`$invoiceId/edit/`); closing goes back to `from` — the room that opened
 * it — else to the ledger. After a save the page behind stays (D28).
 */
export function InvoicesLayout() {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const { dialog, close } = useInvoicesDialogRoute();

  if (dialog.kind === 'create') {
    return (
      <InvoiceDrawer
        mode="create"
        open
        prefill={{ type: dialog.prefill.type, patientId: dialog.prefill.patient ?? null }}
        onClose={close}
        onCreated={close}
      />
    );
  }
  if (dialog.kind === 'edit' && dialog.detail) {
    return (
      <InvoiceDrawer
        mode="edit"
        open
        detail={dialog.detail}
        onClose={close}
        onSaved={close}
        onDeleted={close}
      />
    );
  }
  if (dialog.kind === 'preview' && dialog.detail) {
    const { invoice } = dialog.detail;
    return (
      <PrintPreview
        title={t(INVOICE_DRAWER_KEYS.previewTitle[invoice.type], { seq: invoice.seq })}
        sheet={invoiceSheet(dialog.detail)}
        onClose={close}
        testId={INVOICE_DRAWER_TEST_IDS.preview}
      />
    );
  }
  return null;
}
