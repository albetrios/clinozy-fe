import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  type ItemsColumn,
  ItemsField,
  ItemsReadCell,
} from '@/shared/forms/ItemsField/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS } from '../../../medical.constants.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWERS_NS,
} from '../../medical-drawers.constants.ts';
import type { SupplierAccountRow } from '../../medical-partners-contracts.ts';
import { PURCHASE_STAGE_TONES } from '../../medical-tones.ts';
import { useMedicalDates } from '../MedicalCells/medical-dates.ts';

const K = MEDICAL_DRAWER_KEYS.supplier.account;

/** The read-only table's own form: the rows it shows, never sent. */
interface AccountForm {
  rows: SupplierAccountRow[];
}

/** The table's five columns (`medical.md:200`; H:5381). */
function useColumns(): ItemsColumn<AccountForm, 'rows'>[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const { t: tRoom } = useTranslation(MEDICAL_NS);
  const formatPaise = usePaiseFormat();
  const dates = useMedicalDates();
  return [
    {
      id: 'reference',
      header: t(K.reference),
      track: 'minmax(0,1.4fr)',
      cell: ({ row }) => (
        <ItemsReadCell strong>
          {row.kind === 'order'
            ? [displayId.purchaseOrder(row.seq), row.billNo].filter(Boolean).join(' · ')
            : t(K.credit, { batch: row.batchNo })}
        </ItemsReadCell>
      ),
    },
    {
      id: 'date',
      header: t(K.date),
      track: '80px',
      cell: ({ row }) => <ItemsReadCell>{dates.day(row.date)}</ItemsReadCell>,
    },
    {
      id: 'stage',
      header: t(K.stage),
      track: '90px',
      cell: ({ row }) =>
        row.kind === 'order' ? (
          <ItemsReadCell
            className={cn(
              'font-medium',
              TONE_CLASSES[PURCHASE_STAGE_TONES[row.stage]].ink,
            )}
          >
            {tRoom(MEDICAL_KEYS.purchases.stages[row.stage])}
          </ItemsReadCell>
        ) : (
          <ItemsReadCell className={cn('font-medium', TONE_CLASSES.butter.ink)}>
            {t(K.creditStage)}
          </ItemsReadCell>
        ),
    },
    {
      id: 'amount',
      header: t(K.amount),
      track: '90px',
      align: 'end',
      cell: ({ row }) => (
        <ItemsReadCell strong>
          {row.kind === 'order'
            ? formatPaise(row.amount)
            : `− ${formatPaise(row.amount)}`}
        </ItemsReadCell>
      ),
    },
    {
      id: 'balance',
      header: t(K.balance),
      track: '100px',
      align: 'end',
      cell: ({ row }) => {
        if (row.kind === 'credit') return <ItemsReadCell>{t(K.adjusted)}</ItemsReadCell>;
        if (row.stage === 'paid') return <ItemsReadCell>{t(K.paid)}</ItemsReadCell>;
        if (row.due > 0) {
          return (
            <ItemsReadCell className={TONE_CLASSES.blush.ink}>
              {t(K.due, { amount: formatPaise(row.due) })}
            </ItemsReadCell>
          );
        }
        return <ItemsReadCell>{t(K.notBilled)}</ItemsReadCell>;
      },
    },
  ];
}

/**
 * A supplier's Account (`medical.md:200`; H:5381): its orders and credits as
 * read-only item rows — Reference "PO #430 · T-82370" · Date · Stage in its
 * tone · Amount · Balance ("Not billed", "₹2,980 due" in blush, "Paid"; a
 * credit "Adjusted"). The shared items table draws them, so a phone wraps the
 * rows like every other.
 */
export function SupplierAccountRows({
  rows,
  testId,
}: {
  rows: readonly SupplierAccountRow[];
  testId: string;
}) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const form = useForm<AccountForm>({ values: { rows: [...rows] } });
  return (
    <ItemsField
      control={form.control}
      name="rows"
      label={t(K.label)}
      columns={useColumns()}
      readOnly
      removable={false}
      testId={testId}
    />
  );
}
