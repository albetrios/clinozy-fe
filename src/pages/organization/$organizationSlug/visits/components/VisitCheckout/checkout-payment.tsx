import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import {
  VISIT_AMOUNT_MAX_DIGITS,
  VISIT_PAYMENT_MODES,
  type VisitPaymentMode,
} from '@/shared/api/clinic/visits-contracts.ts';
import { Input } from '@/shared/components/ui/input.tsx';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { VISIT_KEYS, VISIT_NS, VISIT_TEST_IDS } from '../../visits.constants.ts';
import { useModeLabel } from './checkout-mode.ts';

const K = VISIT_KEYS.checkout;
const ids = VISIT_TEST_IDS.checkout;

/** The primary action (padding 11px 14px, 14px/500, `primary`) — 44px on a phone. */
const PRIMARY =
  'bg-primary text-primary-foreground hover:bg-primary/90 border-primary rounded-lg border px-3.5 py-2.75 text-sm font-medium shadow-(--elevation-control) max-md:min-h-11';

/** Props of {@link PaymentForm}. */
export interface PaymentFormProps {
  mode: VisitPaymentMode;
  onMode: (mode: VisitPaymentMode) => void;
  /** The amount field as typed (rupees, digits only). */
  amountText: string;
  onAmountText: (text: string) => void;
  /** The amount Receive records, in paise — never more than is owed. */
  amount: number;
  /** What is left once it is recorded, in paise. */
  balance: number;
  partial: boolean;
  receiving: boolean;
  onReceive: () => void;
}

/**
 * "2 · Payment" once the bill exists (KICKOFF §6.13; `today.md:114–121`;
 * H:2650–2659): the mode (UPI · Cash · Card, equal widths, picked butter;
 * Split is the Receive drawer's — AMBER), the amount received (numeric, ≤ 9
 * digits, the open due by default), the balance after it, the part-payment
 * line, and "Receive ₹<n> by <mode>" — `aria-disabled` at ₹0, "Waiting for
 * server…" while the write runs.
 */
export function PaymentForm({
  mode,
  onMode,
  amountText,
  onAmountText,
  amount,
  balance,
  partial,
  receiving,
  onReceive,
}: PaymentFormProps) {
  const { t } = useTranslation(VISIT_NS);
  const formatPaise = usePaiseFormat();
  const modeLabel = useModeLabel();
  const amountId = useId();
  return (
    <>
      <div role="radiogroup" aria-label={t(K.modesLabel)} className="flex gap-1.5">
        {VISIT_PAYMENT_MODES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => onMode(value)}
            data-testid={ids.mode(value)}
            className={cn(
              'text-body flex-1 rounded-lg border py-2',
              mode === value
                ? 'bg-tone-butter border-tone-butter-border'
                : 'bg-transparent',
            )}
          >
            {modeLabel(value)}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={false}
          aria-disabled
          title={t(K.splitHint)}
          data-testid={ids.mode('split')}
          className="text-body text-muted-foreground-strong flex-1 cursor-not-allowed rounded-lg border bg-transparent py-2"
        >
          {t(K.split)}
        </button>
      </div>
      <label
        htmlFor={amountId}
        className="text-muted-foreground-strong flex flex-col gap-1 text-xs"
      >
        {t(K.amount)}
        <Input
          id={amountId}
          value={amountText}
          inputMode="numeric"
          maxLength={VISIT_AMOUNT_MAX_DIGITS}
          onChange={(event) => onAmountText(event.target.value.replace(/\D/g, ''))}
          data-testid={ids.amount}
          className="bg-background dark:bg-background text-foreground border-border h-auto rounded-lg px-3 py-2.25 text-lg tabular-nums shadow-none md:text-lg"
        />
      </label>
      <p className="text-detail text-foreground-soft">
        {t(K.balance, { amount: formatPaise(balance) })}
      </p>
      {partial ? (
        <p className="text-tone-butter-foreground text-xs">{t(K.partial)}</p>
      ) : null}
      <button
        type="button"
        aria-disabled={amount <= 0 || receiving}
        onClick={onReceive}
        data-testid={ids.receive}
        className={cn(PRIMARY, amount <= 0 && 'cursor-not-allowed opacity-55')}
      >
        {receiving
          ? t(K.waiting)
          : t(K.receive, { amount: formatPaise(amount), mode: modeLabel(mode) })}
      </button>
      <p className="text-caption text-muted-foreground-strong leading-[1.45]">
        {t(K.receiveNote)}
      </p>
    </>
  );
}

/** Nothing left to pay once the bill exists: "✓ Complete visit" ends it. */
export function NothingDue({
  completing,
  onComplete,
}: {
  completing: boolean;
  onComplete: () => void;
}) {
  const { t } = useTranslation(VISIT_NS);
  return (
    <>
      <p className="text-detail text-muted-foreground-strong">{t(K.nothingDue)}</p>
      <button
        type="button"
        aria-disabled={completing}
        onClick={onComplete}
        data-testid={ids.complete}
        className={PRIMARY}
      >
        {t(K.completeVisit)}
      </button>
    </>
  );
}
