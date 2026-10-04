import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { LedgerRow } from '@/shared/api/clinic/payments-contracts.ts';
import { CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { PAYMENT_MODE_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  AvatarStack,
  IdPill,
  PersonChip,
  TonePill,
  type TonePillProps,
} from '@/shared/components/Cells/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../payments.constants.ts';
import {
  editSideLabel,
  ledgerModes,
  ledgerModesLabel,
  ledgerWhat,
  useLedgerSubLine,
  useLedgerWhen,
} from './ledger-cells.ts';

/** The Ref cell: "PAY-310" on the 22px grey pill — every entry, whatever its source (`S:647`). */
export function LedgerRefCell({ seq }: { seq: number }) {
  return <IdPill>{displayId.payment(seq)}</IdPill>;
}

/**
 * The What cell: "Received" / "Paid" in the kind's tone (`payments.md:29`) —
 * 24px in the ledger, 22px (`sm`) in Day close's review.
 */
export function LedgerWhatCell({
  row,
  size,
  className,
}: {
  row: Pick<LedgerRow, 'direction' | 'kind'>;
  size?: TonePillProps['size'];
  className?: string;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const what = ledgerWhat(row);
  return (
    <TonePill tone={what.tone} size={size} className={className}>
      {t(what.labelKey)}
    </TonePill>
  );
}

/**
 * The When cell: the day and time, and — once edited — "Edited 1× · last ₹600
 * UPI → ₹700 UPI" in the butter ink under it (`payments.md:29`).
 */
export function LedgerWhenCell({ row }: { row: Pick<LedgerRow, 'paidAt' | 'edits'> }) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const formatPaise = usePaiseFormat();
  const when = useLedgerWhen();
  const last = row.edits.at(-1);
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-body text-foreground-soft truncate leading-[1.3] tabular-nums">
        {when(row.paidAt)}
      </span>
      {last ? (
        <span className="text-caption text-tone-butter-foreground truncate tabular-nums">
          {t(PAYMENTS_KEYS.ledger.edited, {
            count: row.edits.length,
            from: editSideLabel(last.from, t, tClinic, formatPaise),
            to: editSideLabel(last.to, t, tClinic, formatPaise),
          })}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The From / to cell (`payments.md:29`): a patient as the person chip with the
 * "P" badge, a payee as plain 13px/500 text — each over its sub line ("Sale ·
 * Invoice #785", "Consumables · Gloves, gauze, alcohol swabs").
 */
export function LedgerPartyCell({ row }: { row: LedgerRow }) {
  const subLine = useLedgerSubLine();
  const sub = subLine(row);
  if (row.patientId) {
    return <PersonChip name={row.partyName} sub={sub || undefined} tone="sage" patient />;
  }
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-body truncate leading-[1.3] font-medium">
        {row.partyName}
      </span>
      {sub ? (
        <span className="text-caption text-muted-foreground truncate">{sub}</span>
      ) : null}
    </span>
  );
}

/** The Mode cell: one pill in the mode's tone; splits joined, "Cash + UPI" (`payments.md:29`). */
export function LedgerModeCell({
  row,
  size,
}: {
  row: Pick<LedgerRow, 'splits'>;
  size?: TonePillProps['size'];
}) {
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const modes = ledgerModes(row);
  const first = modes[0];
  if (!first) return null;
  return (
    <TonePill tone={PAYMENT_MODE_TONES[first]} size={size}>
      {ledgerModesLabel(modes, tClinic)}
    </TonePill>
  );
}

/**
 * The Amount cell: "+ ₹600" in the sage ink, "− ₹260" in the blush, 600, at
 * the inline end (`payments.md:29`).
 */
export function LedgerAmountCell({
  row,
  className,
}: {
  row: Pick<LedgerRow, 'direction' | 'amount'>;
  className?: string;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatPaise = usePaiseFormat();
  const received = row.direction === 'received';
  return (
    <span
      className={cn(
        'text-body font-semibold whitespace-nowrap tabular-nums',
        received ? 'text-tone-sage-foreground' : 'text-tone-blush-foreground',
        className,
      )}
    >
      {t(received ? PAYMENTS_KEYS.ledger.received : PAYMENTS_KEYS.ledger.paid, {
        amount: formatPaise(row.amount),
      })}
    </span>
  );
}

/** The By cell: who recorded it — the 28px pill, avatar and "Riya S." (`payments.md:29`). */
export function LedgerByCell({ row }: { row: Pick<LedgerRow, 'by'> }) {
  if (!row.by) return <span className="text-muted-foreground">—</span>;
  return (
    <AvatarStack
      nameFirst
      people={[
        {
          id: row.by.id,
          name: row.by.name,
          initials: row.by.initials,
          tone: row.by.tone,
        },
      ]}
      className="min-w-0"
    />
  );
}
