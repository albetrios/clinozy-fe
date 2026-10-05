import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type {
  VisitDetail,
  VisitPaymentMode,
} from '@/shared/api/clinic/visits-contracts.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import {
  useCompleteVisit,
  useCreateVisitBill,
  useReceiveVisitPayment,
} from '@/shared/hooks/useVisits/index.ts';
import { notify } from '@/shared/notify/index.ts';

import type { VisitSave } from '../../hooks/useVisitSave/index.ts';
import { amountFromText, amountText, visitBill } from '../../visits.bill.ts';
import { VISIT_KEYS, VISIT_NS, VISIT_TEST_IDS } from '../../visits.constants.ts';
import { NeedsPatient } from '../VisitSheet/needs-patient.tsx';
import { CheckoutBill } from './checkout-bill.tsx';
import { useModeLabel } from './checkout-mode.ts';
import { NothingDue, PaymentForm } from './checkout-payment.tsx';

const K = VISIT_KEYS.checkout;
const ids = VISIT_TEST_IDS.checkout;

/** Props of {@link VisitCheckout}. */
export interface VisitCheckoutProps {
  detail: VisitDetail;
  save: VisitSave;
  /** Receive (and Complete visit) close the sheet. */
  onClose: () => void;
}

/**
 * Visit sheet › Checkout (KICKOFF §6.13; `today.md:110–121, 263–267`;
 * H:2624–2662, H:4627–4630): "1 · Bill" (the visit's lines, the totals,
 * "Create bill" — one invoice of the clinic type) and "2 · Payment" — before
 * the bill, why the two are apart; after it, the payment. Receive is not
 * optimistic and single-flight (one payment however often it is pressed);
 * once the server confirms, the sheet closes and the card moves to the
 * pharmacy (an Rx to fill) or leaves the floor. With nothing to pay, the
 * visit completes. Two columns from `md`, one below.
 */
export function VisitCheckout({ detail, save, onClose }: VisitCheckoutProps) {
  const { t } = useTranslation(VISIT_NS);
  const formatPaise = usePaiseFormat();
  const modeLabel = useModeLabel();
  const createBill = useCreateVisitBill();
  const receive = useReceiveVisitPayment();
  const complete = useCompleteVisit();
  const [mode, setMode] = useState<VisitPaymentMode>('upi');
  const [typed, setTyped] = useState<string | null>(null);

  if (!detail.person.patientId) return <NeedsPatient />;

  const visitId = detail.visit.id;
  const bill = visitBill(detail);
  const text = typed ?? amountText(bill.toPay);
  // Rupees typed; never more than is owed (an amount above it leaves ₹0, `today.md:115`).
  const amount = Math.min(amountFromText(text), bill.toPay);

  const onCreate = () => {
    if (createBill.isPending) return;
    void save.run(
      () => createBill.mutateAsync({ visitId }),
      () => setTyped(null),
    );
  };

  const onReceive = () => {
    if (amount <= 0 || receive.isPending) return;
    void save.run(
      () => receive.mutateAsync({ visitId, amount, mode }),
      (receipt) => {
        notify.success(
          t(K.received, {
            amount: formatPaise(receipt.amount),
            mode: modeLabel(mode),
            number: displayId.payment(receipt.paymentSeq),
          }),
        );
        onClose();
      },
    );
  };

  const onComplete = () => {
    if (complete.isPending) return;
    void save.run(
      () => complete.mutateAsync({ visitId }),
      () => {
        notify.success(t(K.completed, { name: detail.person.name }));
        onClose();
      },
    );
  };

  const payment = () => {
    if (!detail.invoice) {
      return (
        <p className="text-detail text-muted-foreground-strong leading-[1.5]">
          {t(K.billFirst)}
        </p>
      );
    }
    if (bill.toPay <= 0) {
      return <NothingDue completing={complete.isPending} onComplete={onComplete} />;
    }
    return (
      <PaymentForm
        mode={mode}
        onMode={setMode}
        amountText={text}
        onAmountText={setTyped}
        amount={amount}
        balance={Math.max(0, bill.toPay - amount)}
        partial={amount > 0 && amount < bill.toPay}
        receiving={receive.isPending}
        onReceive={onReceive}
      />
    );
  };

  return (
    <div
      data-testid={ids.root}
      className="grid h-full min-h-0 grid-cols-1 max-md:h-auto md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
    >
      <CheckoutBill
        detail={detail}
        bill={bill}
        creating={createBill.isPending}
        onCreate={onCreate}
      />
      <div className="bg-canvas flex min-h-0 flex-col gap-3 border-t px-5.5 py-4 max-md:px-3 md:border-s md:border-t-0">
        <h3 className="font-heading text-base font-semibold tracking-[-0.02em]">
          {t(K.payment)}
        </h3>
        {payment()}
      </div>
    </div>
  );
}
