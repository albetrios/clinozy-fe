import type { TFunction } from 'i18next';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { InvoicePresets } from '@/shared/api/clinic/invoices-contracts.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { invoiceLineRate } from '@/shared/api/clinic/offerings-pricing.ts';
import type { PlanSuggestion } from '@/shared/api/clinic/plan-fixture-contracts.ts';
import type { QuickFillItem } from '@/shared/components/QuickFillRow/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { INVOICE_DRAWER_KEYS, INVOICE_DRAWER_NS } from './invoice-drawer.constants.ts';
import {
  blankLine,
  type InvoiceFormValues,
  type InvoiceLineForm,
  namedLines,
} from './invoice-form.ts';
import { type InvoiceCatalogItem, lineFromCatalog } from './invoice-lines.ts';
import type { InvoiceCatalog } from './use-invoice-catalog.ts';

const K = INVOICE_DRAWER_KEYS.presets;

/** What the Quick fill presets read. */
export interface InvoiceQuickFillInput {
  form: UseFormReturn<InvoiceFormValues>;
  values: InvoiceFormValues;
  catalog: InvoiceCatalog;
  /** The patient's packages, last invoices and latest Rx; null before a patient. */
  presets: InvoicePresets | null;
  /** The patient's plan rows; empty before a patient. */
  plan: readonly PlanSuggestion[];
  /** The saved invoice's id on an edit — it never repeats itself. */
  invoiceId: string | null;
  /** "⚡ Print invoice" — a saved invoice only. */
  onPrint: (() => void) | null;
}

/**
 * A plan row as a line (H:5066): the units still to invoice at the list price,
 * the plan's final price as the discount — the whole line's, against the list
 * price of every unit it planned.
 */
function planLine(
  row: PlanSuggestion,
  offering: OfferingRecord,
  left: number,
): InvoiceLineForm {
  const list = row.listPrice * row.qty;
  const final = row.price ?? list;
  return {
    ...blankLine(),
    offeringId: offering.id,
    name: offering.name,
    qty: left,
    rate: invoiceLineRate(row.listPrice, offering.gstPct, offering.gstInclusive),
    gstPct: offering.gstPct,
    discountPct: list > 0 ? Math.max(0, Math.min(100, (1 - final / list) * 100)) : 0,
  };
}

/** "⚡ Plan · <offering> ×2" (lav): each plan row not yet invoiced or on the invoice. */
function planPresets(input: InvoiceQuickFillInput, t: TFunction): QuickFillItem[] {
  const { values, catalog, plan, form } = input;
  if (values.type === 'medical') return [];
  const onInvoice = new Set(namedLines(values.items).map((line) => line.offeringId));
  return plan.flatMap((row): QuickFillItem[] => {
    const left = row.qty - row.invoicedQty;
    const offering = catalog.offerings.get(row.offeringId);
    if (
      row.status === 'declined' ||
      left <= 0 ||
      !offering ||
      onInvoice.has(offering.id)
    ) {
      return [];
    }
    return [
      {
        id: `plan-${row.id}`,
        label:
          left > 1
            ? t(K.planQty, { name: offering.name, count: left })
            : t(K.plan, { name: offering.name }),
        tone: 'lav',
        onSelect: () =>
          form.setValue(
            'items',
            [...namedLines(form.getValues('items')), planLine(row, offering, left)],
            { shouldDirty: true },
          ),
      },
    ];
  });
}

/** "⚡ Package · <offering>" (its tone): another unit of a package the patient holds. */
function packagePresets(input: InvoiceQuickFillInput, t: TFunction): QuickFillItem[] {
  const { values, catalog, presets, form } = input;
  if (values.type !== 'clinic' || !presets) return [];
  const seen = new Set<string>();
  return presets.packages.flatMap((pack): QuickFillItem[] => {
    const item = catalog.byKey.get(pack.offeringId);
    if (!item || seen.has(item.key)) return [];
    seen.add(item.key);
    const offering = catalog.offerings.get(item.key);
    return [
      {
        id: `package-${item.key}`,
        label: t(K.package, { name: item.label }),
        tone: offering?.tone,
        onSelect: () =>
          form.setValue('items', [lineFromCatalog(item)], { shouldDirty: true }),
      },
    ];
  });
}

/** "⚡ Repeat #785" (sky): the patient's last invoice of this type — its lines and team. */
function repeatPreset(input: InvoiceQuickFillInput, t: TFunction): QuickFillItem[] {
  const { values, presets, form, invoiceId } = input;
  const last = presets?.lastByType[values.type];
  if (!last || last.id === invoiceId) return [];
  return [
    {
      id: 'repeat',
      label: t(K.repeat, { seq: last.seq }),
      tone: 'sky',
      onSelect: () => {
        form.setValue(
          'items',
          last.items.map((item) => ({ ...item, batchNo: null })),
          { shouldDirty: true },
        );
        if (last.teamIds.length > 0) {
          form.setValue('teamIds', [...last.teamIds], { shouldDirty: true });
        }
      },
    },
  ];
}

/** "⚡ New consultation · ₹300" (lav): the clinic's consultation, on a consultation invoice. */
function consultationPreset(
  input: InvoiceQuickFillInput,
  t: TFunction,
  formatPaise: (paise: number) => string,
): QuickFillItem[] {
  const { values, catalog, form } = input;
  const consultation = values.type === 'consultation' ? catalog.items[0] : undefined;
  if (!consultation) return [];
  return [
    {
      id: 'consultation',
      label: t(K.consultation, { amount: formatPaise(consultation.price) }),
      tone: 'lav',
      onSelect: () =>
        form.setValue('items', [lineFromCatalog(consultation)], { shouldDirty: true }),
    },
  ];
}

/** The latest Rx's medicines as lines — matched by id, else by name; the rest named in a toast. */
export function rxLines(
  rx: NonNullable<InvoicePresets['latestRx']>,
  catalog: readonly InvoiceCatalogItem[],
): { lines: InvoiceLineForm[]; unmatched: string[] } {
  const lines: InvoiceLineForm[] = [];
  const unmatched: string[] = [];
  for (const medicine of rx.medicines) {
    const item =
      catalog.find((entry) => entry.key === medicine.medicineId) ??
      catalog.find((entry) => entry.label.toLowerCase() === medicine.name.toLowerCase());
    if (item) lines.push(lineFromCatalog(item, { qty: medicine.qty }));
    else if (medicine.name) unmatched.push(medicine.name);
  }
  return { lines, unmatched };
}

/** "⚡ From Rx #500" (sage): the patient's latest prescription, on a Medical invoice. */
function rxPreset(input: InvoiceQuickFillInput, t: TFunction): QuickFillItem[] {
  const { values, presets, catalog, form } = input;
  const rx = values.type === 'medical' ? presets?.latestRx : null;
  if (!rx) return [];
  return [
    {
      id: 'rx',
      label: t(K.rx, { seq: rx.seq }),
      tone: 'sage',
      onSelect: () => {
        const { lines, unmatched } = rxLines(rx, catalog.items);
        form.setValue('items', lines.length > 0 ? lines : [blankLine()], {
          shouldDirty: true,
        });
        form.setValue('prescriptionId', rx.id, { shouldDirty: true });
        for (const name of unmatched) {
          notify.info(t(INVOICE_DRAWER_KEYS.toasts.rxUnmatched, { name }));
        }
      },
    },
  ];
}

/**
 * The drawer's Quick fill (H:5066; `payments.md:147`): "Print invoice" for a
 * saved one (peach), then — for the patient picked — their plan rows still
 * to invoice (lav), the packages they hold, a repeat of their last invoice of
 * this type (sky), a new consultation on a consultation invoice, and their
 * latest Rx on a Medical one (sage). None saves.
 */
export function useInvoiceQuickFill(input: InvoiceQuickFillInput): QuickFillItem[] {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const print: QuickFillItem[] = input.onPrint
    ? [{ id: 'print', label: t(K.print), tone: 'peach', onSelect: input.onPrint }]
    : [];
  return [
    ...print,
    ...planPresets(input, t),
    ...packagePresets(input, t),
    ...repeatPreset(input, t),
    ...consultationPreset(input, t, formatPaise),
    ...rxPreset(input, t),
  ];
}
