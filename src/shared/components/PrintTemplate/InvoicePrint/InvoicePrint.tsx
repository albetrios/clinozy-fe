import { paiseOfRupees } from '@/lib/number-text.ts';
import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type {
  InvoiceLine,
  InvoiceParty,
  InvoiceRecord,
  InvoiceSheet,
} from '@/shared/api/app/invoices-contracts.ts';
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

const keys = PRINT_TEMPLATE_KEYS.invoice;

/** The words that change in the sheet's Medical form (H:4416). */
const FORM_KEYS = {
  clinic: {
    party: PRINT_TEMPLATE_KEYS.patientInformation,
    details: keys.invoiceDetails,
    date: keys.invoiceDate,
    number: keys.invoiceNumber,
    items: keys.items,
    itemName: keys.item,
  },
  medical: {
    party: keys.customerInformation,
    details: keys.saleDetails,
    date: keys.saleDate,
    number: keys.saleNumber,
    items: keys.medicineItems,
    itemName: keys.medicineName,
  },
} as const;

/** Item · Pack Size · Qty · Amount · Discount · GST · Net Amt. (H:442); the last takes the rest. */
const COLUMN_WIDTHS = [
  'w-[60.2mm]',
  'w-[16.9mm]',
  'w-[15mm]',
  'w-[17.2mm]',
  'w-[21.1mm]',
  'w-[15.9mm]',
  undefined,
] as const;

/**
 * A pharmacy bill's columns: the name gives 15mm to an HSN column after the pack size
 * (change-pharmacy-record-fields D3), so the page keeps its width.
 */
const MEDICAL_COLUMN_WIDTHS = [
  'w-[45.3mm]',
  'w-[16.9mm]',
  'w-[14.9mm]',
  'w-[15mm]',
  'w-[17.2mm]',
  'w-[21.1mm]',
  'w-[15.9mm]',
  undefined,
] as const;

/** The pack units a name can carry (H:4416), longest first so "gm" wins over "g". */
const PACK_UNITS = ['caps', 'tabs', 'tab', 'gm', 'ml', 'mg', 'g'] as const;

const isNumber = (word: string) => /^[\d.]+$/.test(word) && !Number.isNaN(Number(word));

const isUnit = (word: string) =>
  (PACK_UNITS as readonly string[]).includes(word.toLowerCase());

/** A number with its unit in one word: "60g", "1.5ml". */
function isPackWord(word: string): boolean {
  const unit = PACK_UNITS.find((candidate) => word.toLowerCase().endsWith(candidate));
  return unit !== undefined && isNumber(word.slice(0, -unit.length));
}

/**
 * The pack size a line prints: its own, else the one in its name — "60g", or a
 * number and its unit across two words, "50 ml" (H:4416).
 */
function packSize(item: Pick<InvoiceLine, 'packSize' | 'name'>): string {
  if (item.packSize) return item.packSize;
  const words = item.name.split(' ');
  for (const [index, word] of words.entries()) {
    if (isPackWord(word)) return word;
    const unit = words[index + 1];
    if (unit && isNumber(word) && isUnit(unit)) return `${word} ${unit}`;
  }
  return '';
}

type PrintFormat = ReturnType<typeof usePrintFormat>;

/** What the invoice and sale sheets print from. */
export interface InvoicePrintProps {
  /** The invoice as clinozy-be keeps it. A Medical invoice prints in the sheet's Medical form (H:4416). */
  invoice: InvoiceRecord;
  /**
   * The Medical sale the invoice belongs to — the sale print. Its number ("S-983") is the one
   * printed; without it the invoice's statutory number ("2026-27/0005") is.
   */
  sale?: { seq: number } | null;
  /** Who it bills — the patient, or a Medical walk-in. */
  party: Pick<InvoiceParty, 'name' | 'phone'> | null;
  /** The clinic: its name and specialties for the footer, its currency. */
  organization: InvoiceSheet['organization'];
  /** The invoice's branch: its phone and GSTIN for the footer; null when not readable. */
  branch: InvoiceSheet['branch'];
}

/** A footer for a branch the member's list no longer has: no phone, no GSTIN. */
const NO_BRANCH = { phone: '', gstNumber: null } as const;

/**
 * The A4 invoice — and, for a Medical invoice, the sale sheet (KICKOFF §6.7, §6.9; H:435–454):
 * who is billed and the invoice details, the items with each line's amount, discount, GST and
 * net and their totals, the remark, the payment summary, and the clinic's footer. Every figure
 * is the server's (the line amounts, the totals, what is paid and due); presentational — the
 * caller passes the invoice as read; nothing is fetched or worked out here.
 */
export function InvoicePrint({
  invoice,
  sale = null,
  party,
  organization,
  branch,
}: InvoicePrintProps) {
  const { t } = usePrintTranslation();
  const format = usePrintFormat(organization.currency);
  const medical = invoice.type === 'medical';
  const form = FORM_KEYS[medical ? 'medical' : 'clinic'];
  const boxClassName = 'min-h-[26.5mm] px-[2.28mm] pt-[2.3mm]';

  return (
    <PrintSheet kind="invoice" testId={PRINT_TEMPLATE_TEST_IDS.invoice}>
      <div className="grid grid-cols-[80.5mm_80.2mm] gap-x-[8.8mm]">
        <PrintBox
          title={t(form.party)}
          className={boxClassName}
          titleClassName="pb-[1.6mm]"
        >
          <dl className="mt-[1.1mm] flex flex-col">
            <PrintField
              className="gap-[3mm]"
              label={t(PRINT_TEMPLATE_KEYS.name)}
              value={party?.name || '—'} // NOSONAR(S6606): a blank name prints the dash
              strong
              valueClassName="uppercase"
            />
            <PrintField
              className="gap-[3mm]"
              label={t(keys.phone)}
              // "91" and the ten digits, as the sheet prints a phone (H:4415).
              value={party?.phone ? party.phone.replace(/^\+/, '') : '—'}
            />
          </dl>
        </PrintBox>
        <PrintBox
          title={t(form.details)}
          className={boxClassName}
          titleClassName="pb-[1.6mm]"
        >
          <dl className="mt-[1.1mm] flex flex-col">
            <PrintField
              className="gap-[3mm]"
              label={t(form.date)}
              value={format.date(invoice.date)}
              strong
            />
            <PrintField
              className="gap-[3mm]"
              // The sale's own number under "Sale #"; without the sale, the invoice's under its name.
              label={t(sale ? form.number : keys.invoiceNumber)}
              value={sale ? displayId.sale(sale.seq) : invoice.number}
              strong
            />
            <PrintField
              className="gap-[3mm]"
              label={t(keys.status)}
              value={t(keys.statuses[invoice.status])}
              valueClassName="uppercase"
            />
          </dl>
        </PrintBox>
      </div>

      <div className="mt-[2.44mm] h-[3.9mm] leading-[3.9mm] font-bold">
        {t(form.items)}
      </div>
      <InvoiceItemsTable
        invoice={invoice}
        itemNameKey={form.itemName}
        format={format}
        medical={medical}
      />

      <div className="mt-[4.55mm] grid grid-cols-[80.5mm_80.2mm] gap-x-[8.8mm]">
        <PrintBox
          title={t(keys.notes)}
          className="min-h-[35.5mm] px-[2.28mm] pt-[2.3mm]"
          titleClassName="pb-[1.6mm]"
        >
          {/* The Remark is the one note that prints (D33; the prototype read `note`). */}
          <p className="mt-[1.95mm] leading-[3.9mm] wrap-anywhere">
            {
              invoice.remark || t(keys.noNotes) // NOSONAR(S6606): a blank remark prints "No notes"
            }
          </p>
        </PrintBox>
        <InvoicePaymentSummary invoice={invoice} format={format} />
      </div>

      <PrintFooter
        kind="invoice"
        organization={organization}
        branch={branch ?? NO_BRANCH}
        medical={medical}
      />
    </PrintSheet>
  );
}

/** The items table with its totals row (H:441–445), each figure the server's. */
function InvoiceItemsTable({
  invoice,
  itemNameKey,
  format,
  medical,
}: {
  invoice: InvoiceRecord;
  itemNameKey: string;
  format: PrintFormat;
  medical: boolean;
}) {
  const { t } = usePrintTranslation();
  return (
    <div className="border-border-strong mt-[1.95mm] overflow-hidden rounded-md border">
      <table
        data-testid={PRINT_TEMPLATE_TEST_IDS.invoiceItems}
        className="w-full table-fixed border-separate border-spacing-0"
      >
        <colgroup>
          {(medical ? MEDICAL_COLUMN_WIDTHS : COLUMN_WIDTHS).map((width) => (
            <col key={width ?? 'rest'} className={width} />
          ))}
        </colgroup>
        <thead>
          <tr className="*:border-border-strong h-[13mm] leading-[4.23mm] font-bold *:border-b">
            <th scope="col" className="ps-[4.4mm] text-start">
              {t(itemNameKey)}
            </th>
            <th scope="col" className="text-center">
              {/* "Pack" over "Size" (H:442): as narrow as its longest word. */}
              <span className="inline-block w-min">{t(keys.packSize)}</span>
            </th>
            {medical ? (
              <th scope="col" className="text-center">
                {t(keys.hsn)}
              </th>
            ) : null}
            <th scope="col" className="text-center">
              {t(keys.qty)}
            </th>
            <th scope="col" className="text-center">
              {t(keys.amount)}
            </th>
            <th scope="col" className="text-center">
              {t(keys.discount)}
            </th>
            <th scope="col" className="pe-[2mm] text-end">
              {t(keys.gst)}
            </th>
            <th scope="col" className="pe-[4.4mm] text-end">
              {t(keys.netAmount)}
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((line, lineIndex) => (
            <tr
              key={line.id}
              // A rule above every line but the first; its 1px comes out of the
              // padding so the row keeps the design's 7.65mm (H:443).
              className={cn(
                'h-[7.65mm] break-inside-avoid leading-[4.23mm] *:py-[1.7mm]',
                lineIndex > 0 && '*:border-border *:border-t *:pt-[calc(1.7mm-1px)]',
              )}
            >
              <td className="ps-[4.4mm] pe-[1mm] uppercase">{line.name}</td>
              <td className="text-center uppercase">{packSize(line)}</td>
              {medical ? <td className="text-center">{line.hsnCode ?? ''}</td> : null}
              <td className="text-center">{format.count(line.qty)}</td>
              {/* The line's gross — its quantity at the rate the server billed. */}
              <td className="text-center">
                {format.money(paiseOfRupees(line.rate) * line.qty)}
              </td>
              <td className="text-center">{format.percent(line.discountPct)}</td>
              <td className="pe-[2mm] text-end">{format.percent(line.gstPct)}</td>
              <td className="pe-[4.4mm] text-end font-bold">
                {format.money(paiseOfRupees(line.amount))}
              </td>
            </tr>
          ))}
        </tbody>
        {/* An ordinary row group: a long bill's header repeats on every page, its
            totals print once, at the end. */}
        <tfoot className="table-row-group">
          <tr className="*:border-border-strong h-[8.8mm] font-bold *:border-t">
            <td colSpan={medical ? 4 : 3} />
            <td className="text-center">
              {format.money(paiseOfRupees(invoice.subtotal))}
            </td>
            {/* The discount total carries no ₹ (payments.md:88). */}
            <td className="text-center">
              {format.amount(paiseOfRupees(invoice.discountTotal))}
            </td>
            <td className="pe-[2mm] text-end">
              {format.money(paiseOfRupees(invoice.gstTotal))}
            </td>
            <td className="pe-[4.4mm] text-end">
              {format.money(paiseOfRupees(invoice.total))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * The taxable amount, GST, the bill and what is still due (H:448–451) — as the server keeps
 * them: the taxable amount and its GST make the bill exactly, every discount already taken.
 */
function InvoicePaymentSummary({
  invoice,
  format,
}: {
  invoice: InvoiceRecord;
  format: PrintFormat;
}) {
  const { t } = usePrintTranslation();
  return (
    <PrintBox
      title={t(keys.paymentSummary)}
      className="min-h-[35.5mm] px-[2.28mm] pt-[2.3mm]"
      titleClassName="pb-[1.6mm]"
    >
      <div data-testid={PRINT_TEMPLATE_TEST_IDS.invoiceSummary}>
        <dl className="border-border-strong mt-[1.3mm] flex flex-col border-b-[0.3mm] pb-[1.3mm] leading-[4.23mm]">
          <div className="flex justify-between font-bold">
            <dt>{t(keys.taxableAmount)}</dt>
            <dd>{format.money(paiseOfRupees(invoice.taxableTotal))}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t(keys.gstTotal)}</dt>
            <dd className="font-bold">{format.money(paiseOfRupees(invoice.gstTotal))}</dd>
          </div>
        </dl>
        <dl className="flex flex-col leading-[4.7mm] font-bold">
          <div className="mt-[2.6mm] flex justify-between text-[3.6mm]">
            <dt>{t(keys.billAmount)}</dt>
            <dd>{format.money(paiseOfRupees(invoice.total))}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t(keys.balanceDue)}</dt>
            <dd>{format.money(paiseOfRupees(invoice.due))}</dd>
          </div>
        </dl>
      </div>
    </PrintBox>
  );
}
