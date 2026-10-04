import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { CreditRow } from '@/shared/api/clinic/credits-contracts.ts';
import {
  CREDIT_DIRECTION_TONES,
  CREDIT_STATUS_TONES,
} from '@/shared/clinic/clinic-tones.ts';
import { IdPill, PersonChip, TonePill } from '@/shared/components/Cells/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../../payments.constants.ts';
import {
  creditReason,
  creditSource,
  creditStateLabel,
  isOpenCredit,
  useCreditSince,
} from './pending-cells.ts';

const K = PAYMENTS_KEYS.pending;

/** An open credit's amount in its way's ink: Give blush, Take sky (`payments.md:45`). */
const AMOUNT_INK = {
  give: 'text-tone-blush-foreground',
  take: 'text-tone-sky-foreground',
} as const;

/** The Ref cell: "CR-2". */
export function PendingRefCell({ seq }: { seq: number }) {
  return <IdPill>{displayId.pendingCredit(seq)}</IdPill>;
}

/**
 * The Who cell: a patient as the person chip with the "P" badge over
 * "Patient"; anyone else as 13px/500 text over "Supplier / party".
 */
export function PendingWhoCell({ credit }: { credit: CreditRow }) {
  const { t } = useTranslation(PAYMENTS_NS);
  if (credit.patientId) {
    return <PersonChip name={credit.partyName} sub={t(K.patient)} tone="sage" patient />;
  }
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-body truncate leading-[1.3] font-medium">
        {credit.partyName}
      </span>
      <span className="text-caption text-muted-foreground truncate">{t(K.party)}</span>
    </span>
  );
}

/** The Which way cell: "Give" blush ("We pay them back") or "Take" sky ("They pay us"). */
export function PendingWayCell({ credit }: { credit: Pick<CreditRow, 'direction'> }) {
  const { t } = useTranslation(PAYMENTS_NS);
  return (
    <TonePill
      tone={CREDIT_DIRECTION_TONES[credit.direction]}
      title={t(K.wayTitles[credit.direction])}
    >
      {t(K.ways[credit.direction])}
    </TonePill>
  );
}

/**
 * The Amount cell: ₹ in the way's ink, 600 — muted once settled — and "₹X
 * adjusted" under it after a part was settled (`payments.md:45`).
 */
export function PendingAmountCell({ credit }: { credit: CreditRow }) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatPaise = usePaiseFormat();
  const open = isOpenCredit(credit);
  return (
    <span className="flex min-w-0 flex-col items-end">
      <span
        className={cn(
          'text-body leading-[1.3] font-semibold whitespace-nowrap tabular-nums',
          open ? AMOUNT_INK[credit.direction] : 'text-muted-foreground',
        )}
      >
        {formatPaise(credit.amount)}
      </span>
      {credit.adjusted > 0 && open ? (
        <span className="text-caption text-muted-foreground whitespace-nowrap tabular-nums">
          {t(K.adjusted, { amount: formatPaise(credit.adjusted) })}
        </span>
      ) : null}
    </span>
  );
}

/** The Why cell: the reason, over where it came from. */
export function PendingWhyCell({ credit }: { credit: CreditRow }) {
  const { t } = useTranslation(PAYMENTS_NS);
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-body truncate leading-[1.3]">{creditReason(credit, t)}</span>
      <span className="text-caption text-muted-foreground truncate">
        {creditSource(credit, t)}
      </span>
    </span>
  );
}

/** The Since cell. */
export function PendingSinceCell({ credit }: { credit: Pick<CreditRow, 'createdAt'> }) {
  const since = useCreditSince();
  return (
    <span className="text-body text-foreground-soft truncate tabular-nums">
      {since(credit)}
    </span>
  );
}

/** The State cell: the state's pill. */
export function PendingStateCell({
  credit,
}: {
  credit: Pick<CreditRow, 'status' | 'settledAt' | 'settledInvoiceSeq'>;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  return (
    <TonePill tone={CREDIT_STATUS_TONES[credit.status]}>
      {creditStateLabel(credit, t)}
    </TonePill>
  );
}
