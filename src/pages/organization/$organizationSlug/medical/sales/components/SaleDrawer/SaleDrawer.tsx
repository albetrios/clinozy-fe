import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { SECTION_TONES } from '@/shared/app/app-tones.ts';
import {
  type DrawerBadge,
  RecordDrawer,
  RecordDrawerPending,
} from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import {
  type ItemsColumn,
  ItemsField,
  ItemsReadCell,
} from '@/shared/forms/ItemsField/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useMedicineUnits } from '@/shared/hooks/useMedicineUnits/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import { useMedicalDates } from '../../../shared/components/MedicalCells/medical-dates.ts';
import {
  MedicalFlowConfirm,
  type MedicalFlowTarget,
} from '../../../shared/components/MedicalFlowConfirm/index.ts';
import type { SaleLine, SaleRow } from '../../../shared/medical-contracts.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';
import { salePaymentOf, useSaleActions } from '../../hooks/useSaleActions/index.ts';

const K = MEDICAL_DRAWER_KEYS.sale;

/** Its medicine rows: 840px, as every drawer holding item rows (H:3850). */
const CONTENT_PROFILE = { fieldCount: 1, hasItems: true } as const;

/** Props of {@link SaleDrawer}. */
export interface SaleDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The sale once read; the drawer shimmers until then. */
  sale: SaleRow | undefined;
  /** "Return medicines" — Return from patient over the list. */
  onReturn: (sale: SaleRow) => void;
  testId?: string;
}

/** The read-only table's own form: the rows it shows, never sent. */
interface LinesForm {
  lines: SaleLine[];
}

/**
 * Medicine · Batch · Qty · Amount (H:5423) — the batches the server drew, its amounts; under a
 * line's name its pack and HSN code as billed, and a loose line's units as packs
 * (change-pharmacy-record-fields D3, D5).
 */
function useColumns(): ItemsColumn<LinesForm, 'lines'>[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatRupees = useRupeeFormat();
  const units = useMedicineUnits();
  return [
    {
      id: 'medicine',
      header: t(K.medicine),
      track: 'minmax(0,2fr)',
      cell: ({ row }) => {
        const details = units.details({ pack: row.packSize, hsnCode: row.hsnCode });
        return (
          <ItemsReadCell strong>
            {row.name}
            {details ? (
              <span className="text-caption text-muted-foreground block font-normal">
                {details}
              </span>
            ) : null}
          </ItemsReadCell>
        );
      },
    },
    {
      id: 'batch',
      header: t(K.batch),
      track: '110px',
      cell: ({ row }) => <ItemsReadCell>{row.batchNo ?? '—'}</ItemsReadCell>,
    },
    {
      id: 'qty',
      header: t(K.qty),
      track: '70px',
      align: 'end',
      cell: ({ row }) => (
        <ItemsReadCell>
          {String(row.qty)}
          {units.packEquivalent(row.qty, row.unitsPerPack) ? (
            <span className="text-caption text-muted-foreground block">
              {units.packEquivalent(row.qty, row.unitsPerPack)}
            </span>
          ) : null}
        </ItemsReadCell>
      ),
    },
    {
      id: 'amount',
      header: t(K.amount),
      track: '100px',
      align: 'end',
      cell: ({ row }) => <ItemsReadCell strong>{formatRupees(row.amount)}</ItemsReadCell>,
    },
  ];
}

/** The sale's medicines as read-only item rows. */
function SaleLines({ lines, testId }: { lines: readonly SaleLine[]; testId: string }) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const form = useForm<LinesForm>({ values: { lines: [...lines] } });
  return (
    <ItemsField
      control={form.control}
      name="lines"
      label={t(K.medicines)}
      columns={useColumns()}
      readOnly
      removable={false}
      testId={`${testId}-lines`}
    />
  );
}

/**
 * The header's badges (`medical.md:333`): Paid / Unpaid (the server's due),
 * "Returned ₹239", the invoice when the buyer is a patient ("Invoice
 * #2026-27/0412 · in patient file" — the API's invoice number) and the bill.
 */
function badgesOf(
  sale: SaleRow,
  formatRupees: (rupees: number) => string,
  t: TFunction,
): DrawerBadge[] {
  const badges: DrawerBadge[] = [
    salePaymentOf(sale) === 'paid'
      ? { id: 'status', label: t(K.badges.paid), tone: 'sage' }
      : { id: 'status', label: t(K.badges.unpaid), tone: 'blush' },
  ];
  if (sale.returned > 0) {
    badges.push({
      id: 'returned',
      label: t(K.badges.returned, { amount: formatRupees(sale.returned) }),
      tone: 'lav',
    });
  }
  if (sale.customer?.patientId && sale.invoice) {
    badges.push({
      id: 'invoice',
      label: t(K.badges.invoice, { seq: sale.invoice.number }),
    });
  }
  badges.push({ id: 'bill', label: formatRupees(sale.bill) });
  return badges;
}

/** One opening of the drawer on a read sale. */
function SaleSession({
  open,
  onClose,
  sale,
  onReturn,
  testId,
}: Omit<SaleDrawerProps, 'sale' | 'testId'> & { sale: SaleRow; testId: string }) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const formatRupees = useRupeeFormat();
  const dates = useMedicalDates();
  const actions = useSaleActions();
  const [voiding, setVoiding] = useState<MedicalFlowTarget | null>(null);

  const summary = t(K.summary, {
    count: sale.lines.length,
    amount: formatRupees(sale.bill),
  });
  let primary: { label: string; run: () => void } | null = null;
  if (actions.canCollect(sale)) {
    primary = {
      label: t(K.collect, { amount: formatRupees(sale.due) }),
      run: () => actions.collect(sale),
    };
  } else if (actions.canReturn(sale)) {
    primary = { label: t(K.returnMedicines), run: () => onReturn(sale) };
  }

  return (
    <>
      <RecordDrawer
        open={open}
        onClose={onClose}
        title={t(K.title)}
        tag={`#${sale.seq}`}
        sub={t(
          K.sub,
          isolateValues({
            customer: sale.customer?.name ?? t(K.walkIn),
            when: dates.when(sale.soldAt),
          }),
        )}
        badges={badgesOf(sale, formatRupees, t)}
        content={CONTENT_PROFILE}
        tone={SECTION_TONES.medical}
        summary={summary}
        dismissLabel={tDrawer(RECORD_DRAWER_KEYS.close)}
        saveLabel={primary?.label}
        onSave={primary?.run}
        saveState={actions.collecting ? 'saving' : 'idle'}
        deleteLabel={t(K.voidSale)}
        onDelete={
          actions.canVoid(sale)
            ? () =>
                setVoiding({
                  kind: 'voidSale',
                  id: sale.id,
                  seq: sale.seq,
                  record: summary,
                })
            : undefined
        }
        testId={testId}
      >
        <SaleLines lines={sale.lines} testId={testId} />
      </RecordDrawer>
      <MedicalFlowConfirm
        target={voiding}
        onClose={() => setVoiding(null)}
        onDone={onClose}
      />
    </>
  );
}

/**
 * Sale (KICKOFF §6.7 Drawers; `medical.md:333–338`; H:5422–5426): the read-only
 * sale, 840px — "Rhea Shah · Today 10:12 · a sale is changed by a return, not
 * edited", the Paid / Unpaid, returned, invoice and bill badges, and its
 * medicines with the batches the server drew. A sale still owing offers
 * "Collect ₹563" (one receipt on the ledger, Q-M1, `payment:create`) and, with
 * nothing paid or returned, the red "Void sale" (Medical Delete, Q-M2); one
 * paid in full "Return medicines" (`payment:delete`, MD23, MD24). Sales are
 * never edited (MD19).
 */
export function SaleDrawer({ testId: id, ...props }: SaleDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const testId = id ?? MEDICAL_DRAWER_TEST_IDS.sale;
  if (!props.sale) {
    return (
      <RecordDrawerPending
        open={props.open}
        onClose={props.onClose}
        title={t(K.title)}
        recordLabel={t(MEDICAL_DRAWER_KEYS.records.sale)}
        content={CONTENT_PROFILE}
        testId={testId}
      />
    );
  }
  return (
    <SaleSession
      key={`${session}-${props.sale.id}`}
      {...props}
      sale={props.sale}
      testId={testId}
    />
  );
}
