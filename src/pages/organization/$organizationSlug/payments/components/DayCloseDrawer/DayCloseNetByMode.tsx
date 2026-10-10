import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { PaymentMode } from '@/shared/api/clinic/clinic-schema.ts';
import type { DayCloseView } from '@/shared/api/clinic/day-close-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { PAYMENT_MODE_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  PersonAvatar,
  shortPersonName,
  TonePill,
} from '@/shared/components/Cells/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../payments.constants.ts';
import { StripCell } from './DayCloseStrip.tsx';

const K = PAYMENTS_KEYS.dayClose.strip;

/** The modes the cell always nets; Credit joins only when it moved (Q-G5). */
const STRIP_MODES: readonly PaymentMode[] = ['cash', 'upi', 'card'];

/** One staff chip of the cell. */
type StaffTotal = DayCloseView['staff'][number];

/** A staff chip: the member's avatar and their entries' net; who, how many and the net on hover. */
function StaffChip({ total, testId }: { total: StaffTotal; testId: string }) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatRupees = useRupeeFormat();
  const name = total.person ? shortPersonName(total.person.name) : t(K.staffOther);
  return (
    <span
      title={t(K.staffTitle, {
        name,
        count: total.count,
        amount: formatRupees(total.amount),
      })}
      data-testid={`${testId}-staff-${total.membershipId ?? 'other'}`}
      data-slot="pill"
      className="bg-background text-caption text-foreground-soft inline-flex h-6 items-center gap-1.25 rounded-full border ps-0.5 pe-2 whitespace-nowrap tabular-nums"
    >
      {total.person ? (
        <PersonAvatar
          initials={total.person.initials}
          tone={total.person.tone}
          size="line"
        />
      ) : (
        <span className="text-muted-foreground ps-1.5">{name}</span>
      )}
      {formatRupees(total.amount)}
    </span>
  );
}

/**
 * "Net by mode" (`payments.md:76`; H:5110): a pill per mode with the server's net (`net_by_mode`
 * — a minus when more went out), Credit only when it moved, then a chip per member with their
 * entries' net (`by_member`) — "Farah A. · 3 entries · ₹600" on hover. The working strip and the
 * report share it.
 */
export function DayCloseNetByMode({
  view,
  testId,
  className,
}: {
  view: Pick<DayCloseView, 'netByMode' | 'staff'>;
  /** The strip's test id; the cell is `<testId>-modes`. */
  testId: string;
  className?: string;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const formatRupees = useRupeeFormat();
  const modes = [
    ...STRIP_MODES,
    ...(view.netByMode.credit === 0 ? [] : (['credit'] as const)),
  ];
  return (
    <StripCell
      label={t(K.netByMode)}
      testId={`${testId}-modes`}
      className={cn('gap-1.5', className)}
    >
      <div className="flex flex-wrap gap-1.5">
        {modes.map((mode) => (
          <TonePill
            key={mode}
            tone={PAYMENT_MODE_TONES[mode]}
            data-testid={`${testId}-mode-${mode}`}
            className="tabular-nums"
          >
            {tClinic(CLINIC_KEYS.paymentModes[mode])}
            <span className="ms-1 font-semibold">
              {formatRupees(view.netByMode[mode])}
            </span>
          </TonePill>
        ))}
      </div>
      {view.staff.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {view.staff.map((total) => (
            <StaffChip
              key={total.membershipId ?? 'other'}
              total={total}
              testId={testId}
            />
          ))}
        </div>
      ) : null}
    </StripCell>
  );
}
