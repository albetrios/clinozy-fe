import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { DayCloseView } from '@/shared/api/app/day-close-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { shortPersonName, TonePill } from '@/shared/components/Cells/index.ts';
import {
  DrawerField,
  DrawerInput,
  DrawerNumberInput,
} from '@/shared/components/DrawerField/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { Check } from '@/shared/icons/index.ts';

import {
  DAY_CLOSE_TEST_ID,
  PAYMENTS_KEYS,
  PAYMENTS_NS,
} from '../../payments.constants.ts';
import {
  countDifference,
  countNeedsReason,
  DIFFERENCE_TONES,
  differenceText,
  differenceTone,
  typedRupees,
} from './day-close-view.ts';
import { DayCloseNetByMode } from './DayCloseNetByMode.tsx';
import { DayCloseStrip, StripCell, StripFigure, StripSub } from './DayCloseStrip.tsx';

const K = PAYMENTS_KEYS.dayClose.strip;
const T = `${DAY_CLOSE_TEST_ID}-strip`;

/** The longest count the box holds, as typed (`payments.md:190`). */
const COUNT_MAX_LENGTH = 8;

/** The API's longest difference reason (`difference_reason`, 1–280). */
const DIFFERENCE_REASON_MAX_LENGTH = 280;

/** The count's two fields' messages from the server (`counted_cash`, `difference_reason`). */
export interface DayCountErrors {
  countedCash?: string;
  differenceReason?: string;
}

/** Props of {@link DayCloseWorking}. */
export interface DayCloseWorkingProps {
  view: Pick<
    DayCloseView,
    | 'opening'
    | 'openingAcceptedAt'
    | 'acceptedBy'
    | 'cashIn'
    | 'cashOut'
    | 'expectedCash'
    | 'netByMode'
    | 'staff'
  >;
  /** The drawer's count as typed. */
  count: string;
  onCountChange: (text: string) => void;
  /** Why the count is off, as typed — asked for once it differs from the expected cash. */
  reason: string;
  onReasonChange: (text: string) => void;
  /** The server's refusals of the count, on their fields. */
  errors: DayCountErrors;
  /** Close the day (`payment:update`): without it the count box is read-only. */
  canAct: boolean;
}

/** "Opening cash" — the accepted amount, and who accepted it when (sage). */
function OpeningCell({ view }: { view: DayCloseWorkingProps['view'] }) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatRupees = useRupeeFormat();
  const { time: timeOf } = useAppClock();
  return (
    <StripCell label={t(K.opening)} testId={`${T}-opening`}>
      <StripFigure>{formatRupees(view.opening.cash)}</StripFigure>
      {view.acceptedBy && view.openingAcceptedAt ? (
        <StripSub className="text-success-strong flex items-center gap-1">
          <Check aria-hidden="true" className="size-3 flex-none" />
          <span className="truncate">
            {t(K.acceptedBy, {
              name: shortPersonName(view.acceptedBy.name),
              time: timeOf(view.openingAcceptedAt),
            })}
          </span>
        </StripSub>
      ) : null}
    </StripCell>
  );
}

/**
 * "Why is the count off?" — under the strip once the count differs from the expected cash, or
 * when the server asked for it; clinozy-be keeps it on the close (`difference_reason`).
 */
function DifferenceReason({
  reason,
  onReasonChange,
  error,
  canAct,
}: {
  reason: string;
  onReasonChange: (text: string) => void;
  error: string | undefined;
  canAct: boolean;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const id = `${T}-reason-input`;
  return (
    <DrawerField
      label={t(K.reason)}
      htmlFor={id}
      required
      error={error}
      testId={`${T}-reason`}
      className="bg-background animate-reveal rounded-xl border px-3 py-2.5"
    >
      <DrawerInput
        id={id}
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        placeholder={t(K.reasonPlaceholder)}
        maxLength={DIFFERENCE_REASON_MAX_LENGTH}
        readOnly={!canAct}
        aria-required="true"
        aria-invalid={error ? true : undefined}
        data-testid={id}
      />
    </DrawerField>
  );
}

/**
 * The working day's strip (`payments.md:73–80`; H:5108–5113): the accepted opening cash, the
 * server's cash in and out with what the drawer should hold (`expected_cash`, live while open),
 * the count with its difference pill ("—", "₹0", "−₹40" — a preview of the count being typed;
 * the server's difference is the close's), and the net by mode with each member's net. A count
 * that is off asks why under the strip — clinozy-be refuses a close without it.
 */
export function DayCloseWorking({
  view,
  count,
  onCountChange,
  reason,
  onReasonChange,
  errors,
  canAct,
}: DayCloseWorkingProps) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const formatRupees = useRupeeFormat();
  const counted = typedRupees(count);
  const difference = countDifference(counted, view.expectedCash);
  const tone = DIFFERENCE_TONES[differenceTone(difference)];
  const asksWhy =
    countNeedsReason(counted, view.expectedCash) || errors.differenceReason !== undefined;
  return (
    <div className="flex flex-col gap-3">
      <DayCloseStrip testId={T} className="animate-reveal">
        <OpeningCell view={view} />
        <StripCell label={t(K.cashInOut)} testId={`${T}-cash`}>
          <StripFigure className="flex flex-wrap gap-1.5">
            <span className="text-success-strong">
              {t(K.cashIn, { amount: formatRupees(view.cashIn) })}
            </span>
            <span className="text-destructive">
              {t(K.cashOut, { amount: formatRupees(view.cashOut) })}
            </span>
          </StripFigure>
          <StripSub>
            {t(K.expected, {
              amount: view.expectedCash === null ? '—' : formatRupees(view.expectedCash),
            })}
          </StripSub>
        </StripCell>
        <StripCell label={t(K.counted)} testId={`${T}-count`} className="gap-1.5">
          <DrawerNumberInput
            value={count}
            onValueChange={onCountChange}
            prefix={tDrawer(RECORD_DRAWER_KEYS.currency)}
            placeholder={t(K.countPlaceholder)}
            aria-label={t(K.countLabel)}
            aria-invalid={errors.countedCash ? true : undefined}
            maxLength={COUNT_MAX_LENGTH}
            readOnly={!canAct}
            className="h-8 rounded-md"
            inputClassName="text-end text-sm font-semibold"
            data-testid={`${T}-count-input`}
          />
          {errors.countedCash ? (
            <span
              role="alert"
              data-testid={`${T}-count-error`}
              className="text-destructive text-xs"
            >
              {errors.countedCash}
            </span>
          ) : null}
          <TonePill
            tone={tone}
            size="sm"
            data-testid={`${T}-difference`}
            className={cn(
              'border font-semibold tabular-nums',
              tone === 'neutral' ? 'border-border' : TONE_CLASSES[tone].border,
            )}
          >
            {differenceText(difference, formatRupees)}
          </TonePill>
        </StripCell>
        <DayCloseNetByMode view={view} testId={T} />
      </DayCloseStrip>
      {asksWhy ? (
        <DifferenceReason
          reason={reason}
          onReasonChange={onReasonChange}
          error={errors.differenceReason}
          canAct={canAct}
        />
      ) : null}
    </div>
  );
}
