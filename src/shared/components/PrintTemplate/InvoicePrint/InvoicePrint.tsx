import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import {
  type InvoiceBalance,
  invoiceBalance,
  invoiceLineAmounts,
  type InvoiceTotals,
  invoiceTotals,
} from '@/shared/api/clinic/clinic-money.ts';
import type {
  Branch,
  Invoice,
  InvoiceItem,
  MedicalContact,
  MedicalSale,
  Organization,
  Patient,
  Payment,
} from '@/shared/api/clinic/clinic-schema.ts';
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
function packSize(item: Pick<InvoiceItem, 'packSize' | 'name'>): string {
  if (item.packSize) return item.packSize;
  const words = item.name.split(' ');
  for (const [index, word] of words.entries()) {
    if (isPackWord(word)) return word;
    const unit = words[index + 1];
    if (unit && isNumber(word) && isUnit(unit)) return `${word} ${unit}`;
  }
  return '';
}

const fullName = (person: Pick<Patient, 'firstName' | 'lastName'>) =>
  [person.firstName, person.lastName].filter(Boolean).join(' ');

type PrintFormat = ReturnType<typeof usePrintFormat>;

/** What the invoice and sale sheets print from. */
export interface InvoicePrintProps {
  /** The invoice. A Medical invoice prints in the sheet's Medical form (H:4416). */
  invoice: Invoice;
  /**
   * The Medical sale the invoice belongs to — the sale print. Its number
   * ("S-983") is the one printed; without it the invoice's ("INV-787") is.
   */
  sale?: Pick<MedicalSale, 'seq'> | null;
  /** Ledger entries: those against this invoice give what has been paid. */
  payments: readonly Payment[];
  /** The patient billed … */
  patient?: Pick<Patient, 'firstName' | 'lastName' | 'phone'> | null;
  /** … or the Medical walk-in customer. */
  contact?: Pick<MedicalContact, 'name' | 'phone'> | null;
  /** The clinic: its name and specialties for the footer, its currency. */
  organization: Pick<Organization, 'name' | 'specialties' | 'currency'>;
  /** The invoice's branch: its phone and GSTIN for the footer. */
  branch: Pick<Branch, 'phone' | 'gstNumber'>;
}

/**
 * The A4 invoice — and, for a Medical invoice, the sale sheet (KICKOFF §6.7,
 * §6.9; H:435–454): who is billed and the invoice details, the items with each
 * line's amount, discount, GST and net and their totals, the remark, the
 * payment summary from the ledger, and the clinic's footer. Presentational —
 * the caller passes every record; nothing is fetched here.
 */
export function InvoicePrint({
  invoice,
  sale = null,
  payments,
  patient = null,
  contact = null,
  organization,
  branch,
}: InvoicePrintProps) {
  const { t } = usePrintTranslation();
  const format = usePrintFormat(organization.currency);
  const medical = invoice.type === 'medical';
  const form = FORM_KEYS[medical ? 'medical' : 'clinic'];
  const totals = invoiceTotals(invoice);
  const balance = invoiceBalance(invoice, payments);
  const name = patient ? fullName(patient) : contact?.name;
  const phone = (patient ?? contact)?.phone;
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
              value={name || '—'}
              strong
              valueClassName="uppercase"
            />
            <PrintField
              className="gap-[3mm]"
              label={t(keys.phone)}
              // "91" and the ten digits, as the sheet prints a phone (H:4415).
              value={phone ? phone.replace(/^\+/, '') : '—'}
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
              label={t(form.number)}
              value={sale ? displayId.sale(sale.seq) : displayId.invoice(invoice.seq)}
              strong
            />
            <PrintField
              className="gap-[3mm]"
              label={t(keys.status)}
              value={t(keys.statuses[balance.status])}
              valueClassName="uppercase"
            />
          </dl>
        </PrintBox>
      </div>

      <div className="mt-[2.44mm] h-[3.9mm] leading-[3.9mm] font-bold">
        {t(form.items)}
      </div>
      <InvoiceItemsTable
        items={invoice.items}
        itemNameKey={form.itemName}
        totals={totals}
        format={format}
      />

      <div className="mt-[4.55mm] grid grid-cols-[80.5mm_80.2mm] gap-x-[8.8mm]">
        <PrintBox
          title={t(keys.notes)}
          className="min-h-[35.5mm] px-[2.28mm] pt-[2.3mm]"
          titleClassName="pb-[1.6mm]"
        >
          {/* The Remark is the one note that prints (D33; the prototype read `note`). */}
          <p className="mt-[1.95mm] leading-[3.9mm] wrap-anywhere">
            {invoice.remark || t(keys.noNotes)}
          </p>
        </PrintBox>
        <InvoicePaymentSummary totals={totals} balance={balance} format={format} />
      </div>

      <PrintFooter
        kind="invoice"
        organization={organization}
        branch={branch}
        medical={medical}
      />
    </PrintSheet>
  );
}

/** The items table with its totals row (H:441–445). */
function InvoiceItemsTable({
  items,
  itemNameKey,
  totals,
  format,
}: {
  items: readonly InvoiceItem[];
  itemNameKey: string;
  totals: InvoiceTotals;
  format: PrintFormat;
}) {
  const { t } = usePrintTranslation();
  // A line is known by its position — the contract's own line identity
  // (`invoiceLineIndex`); a printed list never reorders.
  const lines = items.map((item, lineIndex) => ({
    item,
    lineIndex,
    amounts: invoiceLineAmounts(item),
  }));
  return (
    <div className="border-border-strong mt-[1.95mm] overflow-hidden rounded-md border">
      <table
        data-testid={PRINT_TEMPLATE_TEST_IDS.invoiceItems}
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
              {t(itemNameKey)}
            </th>
            <th scope="col" className="text-center">
              {/* "Pack" over "Size" (H:442): as narrow as its longest word. */}
              <span className="inline-block w-min">{t(keys.packSize)}</span>
            </th>
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
          {lines.map(({ item, lineIndex, amounts }) => (
            <tr
              key={lineIndex}
              // A rule above every line but the first; its 1px comes out of the
              // padding so the row keeps the design's 7.65mm (H:443).
              className={cn(
                'h-[7.65mm] break-inside-avoid leading-[4.23mm] *:py-[1.7mm]',
                lineIndex > 0 && '*:border-border *:border-t *:pt-[calc(1.7mm-1px)]',
              )}
            >
              <td className="ps-[4.4mm] pe-[1mm] uppercase">{item.name}</td>
              <td className="text-center uppercase">{packSize(item)}</td>
              <td className="text-center">{format.count(item.qty)}</td>
              <td className="text-center">{format.money(amounts.base)}</td>
              <td className="text-center">{format.percent(item.discountPct)}</td>
              <td className="pe-[2mm] text-end">{format.percent(item.gstPct)}</td>
              <td className="pe-[4.4mm] text-end font-bold">
                {format.money(amounts.net)}
              </td>
            </tr>
          ))}
        </tbody>
        {/* An ordinary row group: a long bill's header repeats on every page, its
            totals print once, at the end. */}
        <tfoot className="table-row-group">
          <tr className="*:border-border-strong h-[8.8mm] font-bold *:border-t">
            <td colSpan={3} />
            <td className="text-center">{format.money(totals.subtotal)}</td>
            {/* The discount total carries no ₹ (payments.md:88). */}
            <td className="text-center">{format.amount(totals.lineDiscount)}</td>
            <td className="pe-[2mm] text-end">{format.money(totals.gst)}</td>
            <td className="pe-[4.4mm] text-end">{format.money(totals.lineNet)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Total, overall discount, bill and what is still due (H:448–451). */
function InvoicePaymentSummary({
  totals,
  balance,
  format,
}: {
  totals: InvoiceTotals;
  balance: InvoiceBalance;
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
            <dt>{t(keys.totalAmount)}</dt>
            <dd>{format.money(totals.lineNet)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t(keys.overallDiscount)}</dt>
            <dd className="font-bold">{format.money(-totals.overallDiscount)}</dd>
          </div>
        </dl>
        <dl className="flex flex-col leading-[4.7mm] font-bold">
          <div className="mt-[2.6mm] flex justify-between text-[3.6mm]">
            <dt>{t(keys.billAmount)}</dt>
            <dd>{format.money(balance.bill)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t(keys.balanceDue)}</dt>
            <dd>{format.money(balance.due)}</dd>
          </div>
        </dl>
      </div>
    </PrintBox>
  );
}
