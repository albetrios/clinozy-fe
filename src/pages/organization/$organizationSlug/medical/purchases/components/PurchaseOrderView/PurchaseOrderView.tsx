import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { paiseOfRupees } from '@/lib/number-text.ts';
import { SECTION_TONES } from '@/shared/app/app-tones.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  DrawerInfo,
} from '@/shared/components/DrawerField/index.ts';
import {
  printDocument,
  PurchaseOrderPrint,
  type PurchaseOrderPrintProps,
} from '@/shared/components/PrintTemplate/index.ts';
import {
  RecordDrawer,
  RecordDrawerPending,
} from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { notifyError } from '@/shared/errors/errorHandler.ts';
import {
  type ItemsColumn,
  ItemsField,
  ItemsReadCell,
} from '@/shared/forms/ItemsField/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { useOrganizationId } from '@/shared/store/useOrganizationStore/index.ts';

import { useMedicalDates } from '../../../shared/components/MedicalCells/medical-dates.ts';
import {
  fetchPurchaseOrderSheet,
  medicalQueryKeys,
} from '../../../shared/medical-api.ts';
import type {
  PurchaseOrderLine,
  PurchaseOrderRow,
  PurchaseOrderSheet,
} from '../../../shared/medical-contracts.ts';
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

/** The read-only table's own form: the order's lines, never sent. */
interface LinesForm {
  lines: PurchaseOrderLine[];
}

/** Medicine · Qty · Free · Rate · Amount (H:5419) — the API's rupees, its amounts read. */
function useColumns(): ItemsColumn<LinesForm, 'lines'>[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatRupees = useRupeeFormat();
  return [
    {
      id: 'medicine',
      header: t(F.medicine),
      track: 'minmax(0,2fr)',
      cell: ({ row }) => <ItemsReadCell strong>{row.medicineName}</ItemsReadCell>,
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
      cell: ({ row }) => <ItemsReadCell>{formatRupees(row.rate)}</ItemsReadCell>,
    },
    {
      id: 'amount',
      header: t(F.amount),
      track: '100px',
      align: 'end',
      cell: ({ row }) => <ItemsReadCell strong>{formatRupees(row.amount)}</ItemsReadCell>,
    },
  ];
}

/** The order's lines as read-only item rows. */
function OrderLines({ order, testId }: { order: PurchaseOrderRow; testId: string }) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatRupees = useRupeeFormat();
  const form = useForm<LinesForm>({ values: { lines: order.lines } });
  return (
    <ItemsField
      control={form.control}
      name="lines"
      label={t(F.items)}
      columns={useColumns()}
      total={formatRupees(order.total)}
      totalLabel={t(F.total)}
      readOnly
      removable={false}
      testId={`${testId}-lines`}
    />
  );
}

/**
 * "Payable ₹2,980", "Paid ₹1,296", "Paid ₹1,200 + ₹96 in supplier credits" or "Paid ₹1,200 of
 * ₹1,296" (`medical.md:334`, MD11) — the server's due, paid and credited, rupees.
 */
function summaryOf(
  order: PurchaseOrderRow,
  formatRupees: (rupees: number) => string,
  t: TFunction,
): string {
  if (order.stage === 'received')
    return t(K.payable, { amount: formatRupees(order.due) });
  if (order.paid + order.credited >= order.total) {
    if (order.credited <= 0) return t(K.paid, { amount: formatRupees(order.total) });
    return t(K.paidWithCredits, {
      paid: formatRupees(order.paid),
      credited: formatRupees(order.credited),
    });
  }
  return t(K.paidOf, {
    paid: formatRupees(order.paid),
    total: formatRupees(order.total),
  });
}

/**
 * The A4 sheet's props for an order as read (Q-M7): its lines as the sheet's items — the
 * API's rupees as the sheet's paise, batch and expiry as received — and the clinic's footer.
 */
function purchaseOrderPrintOf({
  order,
  organization,
  branch,
}: PurchaseOrderSheet): PurchaseOrderPrintProps {
  return {
    order: {
      seq: order.seq,
      date: order.date,
      stage: order.stage,
      supplierBillNo: order.supplierBillNo,
      items: order.lines.map((line) => ({
        medicineId: line.medicineId,
        qty: line.qty,
        free: line.free,
        rate: paiseOfRupees(line.rate),
        batchNo: line.batchNo,
        expiry: line.expiry,
        received: line.received ?? false,
      })),
      paid: paiseOfRupees(order.paid),
      credited: paiseOfRupees(order.credited),
    },
    itemNames: order.lines.map((line) => line.medicineName),
    supplier: {
      name: order.supplier.name,
      phone: order.supplier.phone,
      gstNumber: order.supplier.gstNumber,
    },
    organization: {
      name: organization.name,
      specialties: organization.specialties,
      currency: organization.currency,
    },
    branch,
  };
}

/** An order's A4 purchase order — the browser's dialog 260ms after the sheet renders (H:4423). */
function printPurchaseOrder(sheet: PurchaseOrderSheet) {
  return printDocument(<PurchaseOrderPrint {...purchaseOrderPrintOf(sheet)} />);
}

/** "Print" on a paid order (Q-M7): its sheet read, then printed; a failed read is a toast. */
function usePrintOrder(order: PurchaseOrderRow) {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationId();
  return () =>
    void queryClient
      .query({
        queryKey: medicalQueryKeys.purchaseOrderSheet(organizationId, order.id),
        queryFn: () => fetchPurchaseOrderSheet(order.id),
      })
      .then(printPurchaseOrder)
      .catch((error: unknown) => notifyError(error));
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
  const formatRupees = useRupeeFormat();
  const dates = useMedicalDates();
  const print = usePrintOrder(order);
  const paid = order.stage === 'paid';
  // Paid: "Print" (`medical.md:339`). Received with a due: "Pay ₹2,980", for members who pay.
  let primary: (() => void) | undefined;
  if (paid) primary = print;
  else if (order.stage === 'received' && order.due > 0 && onPay) {
    primary = () => onPay(order);
  }
  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={t(K.title)}
      tag={`#${order.seq}`}
      sub={t(paid ? K.subPaid : K.subReceived, {
        supplier: isolateText(order.supplier.name),
      })}
      content={CONTENT_PROFILE}
      tone={SECTION_TONES.medical}
      summary={summaryOf(order, formatRupees, t)}
      dismissLabel={tDrawer(RECORD_DRAWER_KEYS.close)}
      saveLabel={paid ? t(K.print) : t(K.pay, { amount: formatRupees(order.due) })}
      onSave={primary}
      testId={testId}
    >
      <DrawerFieldGrid>
        <DrawerField span="half" label={t(F.supplier)}>
          <DrawerInfo testId={`${testId}-supplier`}>{order.supplier.name}</DrawerInfo>
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
 * A paid order offers "Print": its A4 purchase order (Q-M7; the prototype
 * only toasts "Printing PO #428", H:5421).
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
