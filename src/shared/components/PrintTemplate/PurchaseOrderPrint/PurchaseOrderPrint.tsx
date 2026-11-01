import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import {
  purchaseLineAmount,
  purchaseOrderDue,
  purchaseOrderTotal,
} from '@/shared/api/app/app-money.ts';
import type {
  Branch,
  MedicalPurchaseOrder,
  Organization,
  PurchaseItem,
  Supplier,
} from '@/shared/api/app/app-schema.ts';
import {
  usePrintFormat,
  usePrintTranslation,
} from '@/shared/components/PrintTemplate/print-format.ts';
import {
  PRINT_TEMPLATE_KEYS,
  PRINT_TEMPLATE_TEST_IDS,
} from '@/shared/components/PrintTemplate/print-template.constants.ts';
import {
  PrintBox,
  PrintField,
  PrintFooter,
  PrintSheet,
} from '@/shared/components/PrintTemplate/PrintTemplate.tsx';

const keys = PRINT_TEMPLATE_KEYS.purchaseOrder;
const words = PRINT_TEMPLATE_KEYS.invoice;

/** Medicine Name · Batch · Expiry · Qty · Free · Rate · Amount (169.5mm); the last takes the rest. */
const COLUMN_WIDTHS = [
  'w-[52mm]',
  'w-[24mm]',
  'w-[16mm]',
  'w-[13mm]',
  'w-[13mm]',
  'w-[22mm]',
  undefined,
] as const;

type PrintFormat = ReturnType<typeof usePrintFormat>;

/** What the purchase order sheet prints from. */
export interface PurchaseOrderPrintProps {
  /**
   * The order: its number and date, its stage, the supplier's bill number, its lines, what is
   * paid and what the supplier's credits set off (paise; none when left out).
   */
  order: Pick<
    MedicalPurchaseOrder,
    'seq' | 'date' | 'stage' | 'supplierBillNo' | 'paid'
  > & {
    /** The lines — each with the server's `amount` (paise, GST included) when it has one. */
    items: readonly (MedicalPurchaseOrder['items'][number] & { amount?: number })[];
    credited?: number;
  };
  /** Each line's medicine name, in the order's order. */
  itemNames: readonly string[];
  /** Who the order is to: the supplier's name, phone and GSTIN. */
  supplier: Pick<Supplier, 'name' | 'phone' | 'gstNumber'>;
  /** The clinic it is from: its name for the footer, its currency. */
  organization: Pick<Organization, 'name' | 'specialties' | 'currency'>;
  /** The branch whose phone and GSTIN the footer prints. */
  branch: Pick<Branch, 'phone' | 'gstNumber'>;
}

/**
 * The A4 purchase order (Q-M7; the prototype only toasts "Printing PO #428",
 * H:5421) on the shared sheet: the supplier and the order's details, the
 * medicine lines — batch and expiry as received, qty, free units, rate and
 * amount — with their totals, the notes, the payment summary through the money
 * module (integer paise) and the clinic's footer. Presentational — the caller
 * passes every record; nothing is fetched here.
 */
export function PurchaseOrderPrint({
  order,
  itemNames,
  supplier,
  organization,
  branch,
}: PurchaseOrderPrintProps) {
  const { t } = usePrintTranslation();
  const format = usePrintFormat(organization.currency);
  const boxClassName = 'min-h-[26.5mm] px-[2.28mm] pt-[2.3mm]';

  return (
    <PrintSheet kind="purchaseOrder" testId={PRINT_TEMPLATE_TEST_IDS.purchaseOrder}>
      <div className="grid grid-cols-[80.5mm_80.2mm] gap-x-[8.8mm]">
        <PrintBox
          title={t(keys.supplierInformation)}
          className={boxClassName}
          titleClassName="pb-[1.6mm]"
        >
          <dl className="mt-[1.1mm] flex flex-col">
            <PrintField
              className="gap-[3mm]"
              label={t(PRINT_TEMPLATE_KEYS.name)}
              value={supplier.name || '—'}
              strong
              valueClassName="uppercase"
            />
            <PrintField
              className="gap-[3mm]"
              label={t(words.phone)}
              // "91" and the ten digits, as the sheets print a phone (H:4415).
              value={supplier.phone ? supplier.phone.replace(/^\+/, '') : '—'}
            />
            <PrintField
              className="gap-[3mm]"
              label={t(keys.gstin)}
              value={supplier.gstNumber || '—'} // NOSONAR(S6606): a blank GSTIN prints the dash
            />
          </dl>
        </PrintBox>
        <PrintBox
          title={t(keys.orderDetails)}
          className={boxClassName}
          titleClassName="pb-[1.6mm]"
        >
          <dl className="mt-[1.1mm] flex flex-col">
            <PrintField
              className="gap-[3mm]"
              label={t(keys.orderDate)}
              value={format.date(order.date)}
              strong
            />
            <PrintField
              className="gap-[3mm]"
              label={t(keys.orderNumber)}
              value={displayId.purchaseOrder(order.seq)}
              strong
            />
            <PrintField
              className="gap-[3mm]"
              label={t(keys.invoiceNumber)}
              value={order.supplierBillNo || '—'} // NOSONAR(S6606): a blank bill number prints the dash
            />
            <PrintField
              className="gap-[3mm]"
              label={t(words.status)}
              value={t(keys.stages[order.stage])}
              valueClassName="uppercase"
            />
          </dl>
        </PrintBox>
      </div>

      <div className="mt-[2.44mm] h-[3.9mm] leading-[3.9mm] font-bold">
        {t(words.medicineItems)}
      </div>
      <PurchaseItemsTable items={order.items} itemNames={itemNames} format={format} />

      <div className="mt-[4.55mm] grid grid-cols-[80.5mm_80.2mm] gap-x-[8.8mm]">
        <PrintBox
          title={t(words.notes)}
          className="min-h-[35.5mm] px-[2.28mm] pt-[2.3mm]"
          titleClassName="pb-[1.6mm]"
        >
          {/* An order carries no note of its own yet (REPLACE_WITH_API, Appendix F). */}
          <p className="text-muted-foreground mt-[1.95mm] leading-[3.9mm]">
            {t(words.noNotes)}
          </p>
        </PrintBox>
        <PurchaseSummary order={order} format={format} />
      </div>

      <PrintFooter kind="purchaseOrder" organization={organization} branch={branch} />
    </PrintSheet>
  );
}

/** The lines with their totals row: the units ordered, the free ones, the amount. */
function PurchaseItemsTable({
  items,
  itemNames,
  format,
}: {
  items: readonly PurchaseItem[];
  itemNames: readonly string[];
  format: PrintFormat;
}) {
  const { t } = usePrintTranslation();
  const units = items.reduce((sum, item) => sum + item.qty, 0);
  const free = items.reduce((sum, item) => sum + item.free, 0);
  // A line is known by its position — the order's own line identity; a
  // printed order never reorders.
  const lines = items.map((item, lineIndex) => ({
    item,
    lineIndex,
    name: itemNames[lineIndex],
  }));
  return (
    <div className="border-border-strong mt-[1.95mm] overflow-hidden rounded-md border">
      <table
        data-testid={PRINT_TEMPLATE_TEST_IDS.purchaseOrderItems}
        className="w-full table-fixed border-separate border-spacing-0"
      >
        <colgroup>
          {COLUMN_WIDTHS.map((width) => (
            <col key={width ?? 'rest'} className={width} />
          ))}
        </colgroup>
        <thead>
          <tr className="*:border-border-strong h-[13mm] leading-[4.23mm] font-bold *:border-b">
            <th scope="col" className="ps-[4.4mm] text-start">
              {t(words.medicineName)}
            </th>
            <th scope="col" className="text-center">
              {t(keys.batch)}
            </th>
            <th scope="col" className="text-center">
              {t(keys.expiry)}
            </th>
            <th scope="col" className="text-center">
              {t(words.qty)}
            </th>
            <th scope="col" className="text-center">
              {t(keys.free)}
            </th>
            <th scope="col" className="pe-[2mm] text-end">
              {t(keys.rate)}
            </th>
            <th scope="col" className="pe-[4.4mm] text-end">
              {t(words.amount)}
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map(({ item, lineIndex, name }) => (
            <tr
              key={lineIndex}
              // A rule above every line but the first; its 1px comes out of the
              // padding so the row keeps the invoice's 7.65mm (H:443).
              className={cn(
                'h-[7.65mm] break-inside-avoid leading-[4.23mm] *:py-[1.7mm]',
                lineIndex > 0 && '*:border-border *:border-t *:pt-[calc(1.7mm-1px)]',
              )}
            >
              <td className="ps-[4.4mm] pe-[1mm] uppercase">{name}</td>
              <td className="text-center uppercase">{item.batchNo ?? '—'}</td>
              <td className="text-center">{item.expiry ?? '—'}</td>
              <td className="text-center">{format.count(item.qty)}</td>
              <td className="text-center">{format.count(item.free)}</td>
              <td className="pe-[2mm] text-end">{format.money(item.rate)}</td>
              <td className="pe-[4.4mm] text-end font-bold">
                {format.money(purchaseLineAmount(item))}
              </td>
            </tr>
          ))}
        </tbody>
        {/* An ordinary row group: a long order's header repeats on every page,
            its totals print once, at the end. */}
        <tfoot className="table-row-group">
          <tr className="*:border-border-strong h-[8.8mm] font-bold *:border-t">
            <td colSpan={3} />
            <td className="text-center">{format.count(units)}</td>
            <td className="text-center">{format.count(free)}</td>
            <td />
            <td className="pe-[4.4mm] text-end">
              {format.money(purchaseOrderTotal(items))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * Total, what is paid, what the supplier's credits set off and what is still due — a received
 * order's bill (`S:830`, MD11).
 */
function PurchaseSummary({
  order,
  format,
}: {
  order: PurchaseOrderPrintProps['order'];
  format: PrintFormat;
}) {
  const { t } = usePrintTranslation();
  const credited = order.credited ?? 0;
  return (
    <PrintBox
      title={t(words.paymentSummary)}
      className="min-h-[35.5mm] px-[2.28mm] pt-[2.3mm]"
      titleClassName="pb-[1.6mm]"
    >
      <div data-testid={PRINT_TEMPLATE_TEST_IDS.purchaseOrderSummary}>
        <dl className="border-border-strong mt-[1.3mm] flex flex-col border-b-[0.3mm] pb-[1.3mm] leading-[4.23mm]">
          <div className="flex justify-between font-bold">
            <dt>{t(words.totalAmount)}</dt>
            <dd>{format.money(purchaseOrderTotal(order.items))}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t(keys.paid)}</dt>
            <dd className="font-bold">{format.money(order.paid)}</dd>
          </div>
          {credited > 0 ? (
            <div className="flex justify-between">
              <dt>{t(keys.credited)}</dt>
              <dd className="font-bold">{format.money(credited)}</dd>
            </div>
          ) : null}
        </dl>
        <dl className="flex flex-col leading-[4.7mm] font-bold">
          <div className="mt-[2.6mm] flex justify-between text-[3.6mm]">
            <dt>{t(words.balanceDue)}</dt>
            <dd>
              {format.money(purchaseOrderDue({ ...order, paid: order.paid + credited }))}
            </dd>
          </div>
        </dl>
      </div>
    </PrintBox>
  );
}
