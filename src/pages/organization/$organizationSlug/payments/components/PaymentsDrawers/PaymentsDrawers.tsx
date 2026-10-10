import { lazy, Suspense } from 'react';

import {
  type PaymentsDialogRoute,
  usePaymentsDialogRoute,
} from '../../hooks/usePaymentsDialogRoute/index.ts';
import { ReceivePaymentDrawer } from '../ReceivePaymentDrawer/index.ts';
import { SendPaymentDrawer } from '../SendPaymentDrawer/index.ts';

/**
 * Day close loads when it opens: the 1040px drawer is the room's heaviest, opened once a day,
 * and the Receive host over the other rooms never opens it.
 */
const DayCloseDrawer = lazy(() =>
  import('../DayCloseDrawer/index.ts').then((module) => ({
    default: module.DayCloseDrawer,
  })),
);

/** Props of {@link PaymentsDrawers}. */
export interface PaymentsDrawersProps {
  dialog: PaymentsDialogRoute;
  onClose: () => void;
  /**
   * Day close's day picker. Day close reviews its day in the ledger behind it,
   * so it opens only over the ledger — where the page passes this.
   */
  onDayChange?: (date: string) => void;
}

/**
 * The drawer the URL names (D24): Receive payment, Send payment, an open
 * day's entry — a receipt in Receive, money out in Send — or Day close on
 * its day (loaded as it opens).
 */
export function PaymentsDrawers({ dialog, onClose, onDayChange }: PaymentsDrawersProps) {
  if (dialog.kind === 'dayClose') {
    return onDayChange ? (
      <Suspense fallback={null}>
        <DayCloseDrawer
          open
          search={dialog.search}
          onDayChange={onDayChange}
          onClose={onClose}
        />
      </Suspense>
    ) : null;
  }
  if (dialog.kind === 'receive') {
    return (
      <ReceivePaymentDrawer
        open
        mode="create"
        prefill={dialog.prefill}
        onClose={onClose}
      />
    );
  }
  if (dialog.kind === 'pay') {
    return (
      <SendPaymentDrawer
        open
        mode="create"
        bill={dialog.prefill.bill}
        onClose={onClose}
      />
    );
  }
  if (dialog.kind !== 'edit' || !dialog.payment) return null;
  const entry = dialog.payment;
  return entry.direction === 'received' ? (
    <ReceivePaymentDrawer
      open
      mode="edit"
      entry={entry}
      readOnly={dialog.readOnly}
      onClose={onClose}
    />
  ) : (
    <SendPaymentDrawer
      open
      mode="edit"
      entry={entry}
      readOnly={dialog.readOnly}
      onClose={onClose}
    />
  );
}

/**
 * The Payments drawers without the ledger: Receive payment over the room that
 * opened it — the patient file, Today, Patients (KICKOFF §4, A-P1) — read from
 * the drawer's own route, which the app's cross-room host provides.
 */
export function PaymentsDialogHost() {
  const { dialog, close } = usePaymentsDialogRoute();
  return <PaymentsDrawers dialog={dialog} onClose={close} />;
}
