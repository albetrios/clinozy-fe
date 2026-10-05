import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { PaymentMode } from '@/shared/api/clinic/clinic-schema.ts';
import type { DayCloseView } from '@/shared/api/clinic/day-close-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { PAYMENT_MODE_TONES, TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  PersonAvatar,
  shortPersonName,
  TonePill,
} from '@/shared/components/Cells/index.ts';
import { DrawerNumberInput } from '@/shared/components/DrawerField/index.ts';
import { useLedgerTime } from '@/shared/components/LedgerCells/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { Check } from '@/shared/icons/index.ts';

import {
  DAY_CLOSE_TEST_ID,
  PAYMENTS_KEYS,
  PAYMENTS_NS,
} from '../../payments.constants.ts';
import {
  cashDifference,
  DIFFERENCE_TONES,
  differenceText,
  differenceTone,
  netText,
  typedPaise,
} from './day-close-view.ts';
import { DayCloseStrip, StripCell, StripFigure, StripSub } from './DayCloseStrip.tsx';

const K = PAYMENTS_KEYS.dayClose.strip;
const T = `${DAY_CLOSE_TEST_ID}-strip`;

/** The modes the strip always nets; Credit joins only when it moved (Q-G5). */
const STRIP_MODES: readonly PaymentMode[] = ['cash', 'upi', 'card'];

/** The longest count the box holds, as typed (`payments.md:190`). */
const COUNT_MAX_LENGTH = 8;

/** Props of {@link DayCloseWorking}. */
export interface DayCloseWorkingProps {
  view: Pick<
    DayCloseView,
    'opening' | 'openingAcceptedAt' | 'acceptedBy' | 'totals' | 'expectedCash' | 'staff'
  >;
  /** The drawer's count as typed. */
  count: string;
  onCountChange: (text: string) => void;
  /** The `dayclose` ability: without it the count box is read-only. */
  canAct: boolean;
}

/** "Net by mode": a pill per mode, "In ₹X · out ₹Y" on hover, then the staff behind the receipts. */
function NetByMode({ view }: { view: DayCloseWorkingProps['view'] }) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const formatPaise = usePaiseFormat();
  const modes = [
    ...STRIP_MODES,
    ...(view.totals.credit.in + view.totals.credit.out > 0 ? (['credit'] as const) : []),
  ];
  return (
    <StripCell label={t(K.netByMode)} testId={`${T}-modes`} className="gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {modes.map((mode) => {
          const flow = view.totals[mode];
          return (
            <TonePill
              key={mode}
              tone={PAYMENT_MODE_TONES[mode]}
              title={t(K.modeTitle, {
                in: formatPaise(flow.in),
                out: formatPaise(flow.out),
              })}
              data-testid={`${T}-mode-${mode}`}
              className="tabular-nums"
            >
              {tClinic(CLINIC_KEYS.paymentModes[mode])}
              <span className="ms-1 font-semibold">
                {netText(flow.in - flow.out, formatPaise)}
              </span>
            </TonePill>
          );
        })}
      </div>
      {view.staff.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {view.staff.map(({ person, receipts, amount }) => (
            <span
              key={person.id}
              title={t(K.staffTitle, {
                name: shortPersonName(person.name),
                count: receipts,
                amount: formatPaise(amount),
              })}
              data-testid={`${T}-staff-${person.id}`}
              data-slot="pill"
              className="bg-background text-caption text-foreground-soft inline-flex h-6 items-center gap-1.25 rounded-full border ps-0.5 pe-2 whitespace-nowrap tabular-nums"
            >
              <PersonAvatar initials={person.initials} tone={person.tone} size="line" />
              {formatPaise(amount)}
            </span>
          ))}
        </div>
      ) : null}
    </StripCell>
  );
}

/**
 * The working day's strip (`payments.md:73–80`; H:5108–5113): the accepted
 * opening cash, cash in and out with what the drawer should hold, the count
 * with its difference pill ("—", "₹0", "−₹40"), and the net by mode — each
 * split row under its own mode, Credit apart (Q-G5).
 */
export function DayCloseWorking({
  view,
  count,
  onCountChange,
  canAct,
}: DayCloseWorkingProps) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const timeOf = useLedgerTime();
  const difference = cashDifference(typedPaise(count), view.expectedCash);
  const tone = DIFFERENCE_TONES[differenceTone(difference)];
  return (
    <DayCloseStrip testId={T} className="animate-reveal">
      <StripCell label={t(K.opening)} testId={`${T}-opening`}>
        <StripFigure>{formatPaise(view.opening.cash)}</StripFigure>
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
      <StripCell label={t(K.cashInOut)} testId={`${T}-cash`}>
        <StripFigure className="flex flex-wrap gap-1.5">
          <span className="text-success-strong">
            {t(K.cashIn, { amount: formatPaise(view.totals.cash.in) })}
          </span>
          <span className="text-destructive">
            {t(K.cashOut, { amount: formatPaise(view.totals.cash.out) })}
          </span>
        </StripFigure>
        <StripSub>{t(K.expected, { amount: formatPaise(view.expectedCash) })}</StripSub>
      </StripCell>
      <StripCell label={t(K.counted)} testId={`${T}-count`} className="gap-1.5">
        <DrawerNumberInput
          value={count}
          onValueChange={onCountChange}
          prefix={tDrawer(RECORD_DRAWER_KEYS.currency)}
          placeholder={t(K.countPlaceholder)}
          aria-label={t(K.countLabel)}
          maxLength={COUNT_MAX_LENGTH}
          readOnly={!canAct}
          className="h-8 rounded-md"
          inputClassName="text-end text-sm font-semibold"
          data-testid={`${T}-count-input`}
        />
        <TonePill
          tone={tone}
          size="sm"
          data-testid={`${T}-difference`}
          className={cn(
            'border font-semibold tabular-nums',
            tone === 'neutral' ? 'border-border' : TONE_CLASSES[tone].border,
          )}
        >
          {differenceText(difference, formatPaise)}
        </TonePill>
      </StripCell>
      <NetByMode view={view} />
    </DayCloseStrip>
  );
}
