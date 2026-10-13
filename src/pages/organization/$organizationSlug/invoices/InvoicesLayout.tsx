import { useTranslation } from 'react-i18next';

import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
  INVOICE_DRAWER_TEST_ID,
  INVOICE_DRAWER_TEST_IDS,
  InvoiceDrawer,
  invoiceSheet,
} from '@/shared/components/InvoiceDrawer/index.ts';
import { PanelSkeleton } from '@/shared/components/PanelSkeleton/index.ts';
import { PrintPreview } from '@/shared/components/PrintPreview/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';

import {
  type InvoiceRead,
  useInvoicesDialogRoute,
} from './hooks/useInvoicesDialogRoute/index.ts';

/** The item rows the drawer will need: the 840px it opens at, so the width does not jump. */
const CONTENT_PROFILE = { fieldCount: 9, hasItems: true } as const;

/**
 * A routed invoice still on its way, or one that could not be read (a dropped line, a 5xx): the
 * drawer's shell over the skeleton, or the failure with Retry in place.
 */
function InvoiceReadState({ read, onClose }: { read: InvoiceRead; onClose: () => void }) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const record = t(INVOICE_DRAWER_KEYS.record);
  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={record}
      content={CONTENT_PROFILE}
      testId={INVOICE_DRAWER_TEST_ID}
    >
      {read.failed ? (
        <RetryError onRetry={read.retry} />
      ) : (
        <PanelSkeleton name={record} testId={`${INVOICE_DRAWER_TEST_ID}-skeleton`} />
      )}
    </RecordDrawer>
  );
}

/**
 * The invoices island (KICKOFF §4, §6.9; `S:92–94`): it has no page of its own — its routes
 * are dialogs over a referrer, the Payments ledger standing behind them (`routeTree.tsx` renders
 * the ledger beside this host, and the ledger's outlet holds the dialog routes, which render
 * nothing). It reads the URL and opens New invoice (`create/`, on `?type=&patient=`, a visit's
 * sessions on `?appointment=`, or a copy of a saved invoice on `?copyOf=`), an invoice's preview with Print (`$invoiceId/`) or Edit
 * invoice (`$invoiceId/edit/`) — each on clinozy-be's invoice as read once (`GET
 * /app/invoices/:id` with its ledger entries and the sheet's clinic and branch), the skeleton
 * while it loads and Retry when it fails; closing goes back to `from` — the room that opened
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
        prefill={{
          type: dialog.prefill.type,
          patientId: dialog.prefill.patient ?? null,
          appointmentId: dialog.prefill.appointment ?? null,
          copyOf: dialog.source,
        }}
        onClose={close}
        onCreated={close}
      />
    );
  }
  if (dialog.kind === 'none') return null;
  if (!dialog.detail) return <InvoiceReadState read={dialog} onClose={close} />;
  if (dialog.kind === 'edit') {
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
