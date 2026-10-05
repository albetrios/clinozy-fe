import type { TFunction } from 'i18next';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { PurchaseItem } from '@/shared/api/clinic/clinic-schema.ts';
import { SECTION_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  DrawerInfo,
} from '@/shared/components/DrawerField/index.ts';
import {
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
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { useMedicalDates } from '../../../shared/components/MedicalCells/medical-dates.ts';
import type { PurchaseOrderRow } from '../../../shared/medical-contracts.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';

const K = MEDICAL_DRAWER_KEYS.orderView;
const F = MEDICAL_DRAWER_KEYS.purchaseOrder.fields;

/** Item rows: 840px (`medical.md:334`). */
const CONTENT_PROFILE = { fieldCount: 3, hasItems: true } as const;

/** Props of {@link PurchaseOrderView}. */
export interface PurchaseOrderViewProps {
  open: boolean;
  onClose: () => void;
  /** The received or paid order once read; the drawer shimmers until then. */
  order: PurchaseOrderRow | undefined;
  /**
   * "Pay ₹2,980" on a received order with something due (Q-M1): Send payment
   * on its bill. Passed only to members who may pay.
   */
  onPay?: (order: PurchaseOrderRow) => void;
  testId?: string;
}

/** One read-only line: its medicine's name beside the stored item. */
interface ViewLine extends PurchaseItem {
  name: string;
}

/** The read-only table's own form: the rows it shows, never sent. */
interface LinesForm {
  lines: ViewLine[];
}

/** Medicine · Qty · Free · Rate · Amount (H:5419). */
function useColumns(): ItemsColumn<LinesForm, 'lines'>[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  return [
    {
      id: 'medicine',
      header: t(F.medicine),
      track: 'minmax(0,2fr)',
      cell: ({ row }) => <ItemsReadCell strong>{row.name}</ItemsReadCell>,
    },
    {
      id: 'qty',
      header: t(F.qty),
      track: '64px',
      align: 'end',
      cell: ({ row }) => <ItemsReadCell>{String(row.qty)}</ItemsReadCell>,
    },
    {
      id: 'free',
      header: t(F.free),
      track: '64px',
      align: 'end',
      cell: ({ row }) => <ItemsReadCell>{String(row.free)}</ItemsReadCell>,
    },
    {
      id: 'rate',
      header: t(F.rate),
      track: '90px',
      align: 'end',
      cell: ({ row }) => <ItemsReadCell>{formatPaise(row.rate)}</ItemsReadCell>,
    },
    {
      id: 'amount',
      header: t(F.amount),
      track: '100px',
      align: 'end',
      cell: ({ row }) => (
        <ItemsReadCell strong>{formatPaise(row.qty * row.rate)}</ItemsReadCell>
      ),
    },
  ];
}

/** The order's lines as read-only item rows. */
function OrderLines({ order, testId }: { order: PurchaseOrderRow; testId: string }) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const lines = order.items.map((item, index) => ({
    ...item,
    name: order.itemNames[index] ?? '',
  }));
  const form = useForm<LinesForm>({ values: { lines } });
  return (
    <ItemsField
      control={form.control}
      name="lines"
      label={t(F.items)}
      columns={useColumns()}
      total={formatPaise(order.total)}
      totalLabel={t(F.total)}
      readOnly
      removable={false}
      testId={`${testId}-lines`}
    />
  );
}

/** "Payable ₹2,980", "Paid ₹1,296" or "Paid ₹1,200 of ₹1,296" (`medical.md:334`). */
function summaryOf(
  order: PurchaseOrderRow,
  formatPaise: (paise: number) => string,
  t: TFunction,
): string {
  if (order.stage === 'received') return t(K.payable, { amount: formatPaise(order.due) });
  if (order.paid >= order.total) return t(K.paid, { amount: formatPaise(order.total) });
  return t(K.paidOf, { paid: formatPaise(order.paid), total: formatPaise(order.total) });
}

/** One opening of the view on a read order. */
function OrderViewSession({
  open,
  onClose,
  order,
  onPay,
  testId,
}: Omit<PurchaseOrderViewProps, 'order' | 'testId'> & {
  order: PurchaseOrderRow;
  testId: string;
}) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const dates = useMedicalDates();
  const payable = order.stage === 'received' && order.due > 0;
  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={t(K.title)}
      tag={`#${order.seq}`}
      sub={t(order.stage === 'paid' ? K.subPaid : K.subReceived, {
        supplier: order.supplierName,
      })}
      content={CONTENT_PROFILE}
      tone={SECTION_TONES.medical}
      summary={summaryOf(order, formatPaise, t)}
      dismissLabel={tDrawer(RECORD_DRAWER_KEYS.close)}
      saveLabel={t(K.pay, { amount: formatPaise(order.due) })}
      onSave={payable && onPay ? () => onPay(order) : undefined}
      testId={testId}
    >
      <DrawerFieldGrid>
        <DrawerField span="half" label={t(F.supplier)}>
          <DrawerInfo testId={`${testId}-supplier`}>{order.supplierName}</DrawerInfo>
        </DrawerField>
        <DrawerField span="third" label={t(F.billNo)}>
          <DrawerInfo testId={`${testId}-bill-no`}>
            {order.supplierBillNo ?? '—'}
          </DrawerInfo>
        </DrawerField>
        <DrawerField span="third" label={t(F.date)}>
          <DrawerInfo testId={`${testId}-date`}>{dates.day(order.date)}</DrawerInfo>
        </DrawerField>
      </DrawerFieldGrid>
      <OrderLines order={order} testId={testId} />
    </RecordDrawer>
  );
}

/**
 * Purchase order (view) (KICKOFF §6.7 Drawers; `medical.md:333–334`;
 * H:5418–5421): a received or paid order, 840px and locked — its supplier,
 * bill and date, and its lines with the total. A received order with
 * something due offers "Pay ₹2,980", which opens Payments › Send payment on
 * its bill (Q-M1: the prototype marked it Paid with no ledger entry); the
 * summary reads "Payable ₹2,980", "Paid ₹1,296" or "Paid ₹1,200 of ₹1,296".
 * Printing a paid order is not built (Q-M7).
 */
export function PurchaseOrderView({ testId: id, ...props }: PurchaseOrderViewProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const testId = id ?? MEDICAL_DRAWER_TEST_IDS.orderView;
  if (!props.order) {
    return (
      <RecordDrawerPending
        open={props.open}
        onClose={props.onClose}
        title={t(K.title)}
        recordLabel={t(MEDICAL_DRAWER_KEYS.records.purchaseOrder)}
        content={CONTENT_PROFILE}
        testId={testId}
      />
    );
  }
  return <OrderViewSession {...props} order={props.order} testId={testId} />;
}
