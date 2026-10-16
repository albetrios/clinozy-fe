import './payment-received.css';

import type { TFunction } from 'i18next';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import { APP_KEYS } from '@/shared/app/app.constants.ts';
import { LottiePlayer } from '@/shared/components/LottiePlayer/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { Check } from '@/shared/icons/index.ts';

import {
  PAYMENT_RECEIVED_KEYS,
  PAYMENT_RECEIVED_NS,
  PAYMENT_RECEIVED_TEST_IDS,
} from './payment-received.constants.ts';
import type { ReceivedOutcome, ReceivedPayment } from './payment-received.ts';
import { loadPaymentReceivedAnimation } from './payment-received-assets.ts';
import { PaymentReviews } from './payment-reviews.tsx';

const K = PAYMENT_RECEIVED_KEYS;
const ids = PAYMENT_RECEIVED_TEST_IDS;

/** What the money did, in a line: "Invoice #785 paid in full", "₹1,200 still due on invoice #785". */
function outcomeText(
  outcome: ReceivedOutcome,
  t: TFunction,
  formatRupees: (rupees: number) => string,
): string {
  switch (outcome.kind) {
    case 'paid':
      return t(K.outcome.paid, { invoice: displayId.invoiceNumber(outcome.invoiceSeq) });
    case 'due':
      return t(K.outcome.due, {
        amount: formatRupees(outcome.due),
        invoice: displayId.invoiceNumber(outcome.invoiceSeq),
      });
    case 'advance':
      return t(K.outcome.advance);
    case 'creditSettled':
      return t(K.outcome.creditSettled, {
        credit: displayId.pendingCredit(outcome.creditSeq),
      });
    case 'creditLeft':
      return t(K.outcome.creditLeft, {
        amount: formatRupees(outcome.left),
        credit: displayId.pendingCredit(outcome.creditSeq),
      });
  }
}

/** The static mark when the animation cannot load: the same disc and check, still. */
function StillMark() {
  return (
    <span className="bg-success text-success-foreground flex size-16 items-center justify-center rounded-full">
      <Check aria-hidden="true" className="size-8" strokeWidth={3} />
    </span>
  );
}

/** Props for {@link PaymentReceived}. */
export interface PaymentReceivedProps {
  payment: ReceivedPayment;
}

/**
 * Payment received (`feat-payment-celebration` D2, D10): the body a drawer turns into once it has
 * taken money from a person — the animation plays once (a ring of sparks around a check, ≈ 0.85s;
 * its last frame under reduced motion), then the amount, who paid, the modes and receipt, and
 * what it did to the invoice or credit; for a patient, the review ask and their previous reviews.
 * Every line is there from the first frame (the body reveals in 240ms on the strong ease-out);
 * nothing waits for the animation.
 */
export function PaymentReceived({ payment }: PaymentReceivedProps) {
  const { t } = useTranslation(PAYMENT_RECEIVED_NS);
  const formatRupees = useRupeeFormat();
  // The save button that brought us here is gone: focus lands on what happened, read out once.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus({ preventScroll: true }), []);
  const modes = payment.modes.map((mode) => t(APP_KEYS.paymentModes[mode])).join(' + ');
  const meta =
    payment.paymentSeq === null
      ? modes
      : t(K.meta, { modes, ref: displayId.payment(payment.paymentSeq) });

  return (
    <div data-testid={ids.view} className="animate-reveal flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1.5 pt-2 text-center">
        <div
          data-slot="payment-received-animation"
          className="flex items-center justify-center"
        >
          <LottiePlayer
            animation={loadPaymentReceivedAnimation}
            fallback={<StillMark />}
            testId={ids.animation}
          />
        </div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          data-testid={ids.amount}
          className="text-foreground text-2xl font-semibold tracking-tight tabular-nums outline-none"
        >
          {t(K.amount, { amount: formatRupees(payment.amount) })}
        </h2>
        <p className="text-body text-muted-foreground-strong">
          {t(K.from, { name: isolateText(payment.payerName) })}
        </p>
        <p className="text-detail text-muted-foreground">{meta}</p>
        <p
          data-testid={ids.outcome}
          data-slot="pill"
          className="text-detail bg-muted text-foreground mt-1.5 rounded-full px-3 py-1 font-medium"
        >
          {outcomeText(payment.outcome, t, formatRupees)}
        </p>
      </div>
      {payment.patientId ? (
        <PaymentReviews
          patientId={payment.patientId}
          contactId={payment.contactId}
          payerName={payment.payerName}
          branchId={payment.branchId}
        />
      ) : null}
    </div>
  );
}
