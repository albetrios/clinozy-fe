import type { TFunction } from 'i18next';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { rupeesOfPaise } from '@/lib/number-text.ts';
import type { InvoicePresets } from '@/shared/api/clinic/invoices-contracts.ts';
import type { InvoiceRxPreset } from '@/shared/api/clinic/invoices-fixture-contracts.ts';
import type { PlanSuggestionRow } from '@/shared/api/clinic/plan-contracts.ts';
import type { TreatmentRecord } from '@/shared/api/clinic/treatments-contracts.ts';
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
  /** An invoice's patient: their packages and last invoices; null before a patient. */
  presets: InvoicePresets | null;
  /** A sale's patient's latest prescription; null otherwise. */
  latestRx: InvoiceRxPreset | null;
  /** The patient's plan rows; empty before a patient (and on a sale). */
  plan: readonly PlanSuggestionRow[];
  /** The saved invoice's id on an edit — it never repeats itself. */
  invoiceId: string | null;
  /** "⚡ Print invoice" — a saved invoice only. */
  onPrint: (() => void) | null;
}

/** A percentage to the two places the API takes. */
const twoPlaces = (value: number) => Math.round(value * 100) / 100;

/**
 * A plan row as a line (H:5066): the offering, the units still to invoice, the row it bills —
 * and, when the plan agreed a price of its own, the discount that brings the offering's billed
 * price to it (the server's preview shows what it comes to).
 */
function planLine(
  row: PlanSuggestionRow,
  item: InvoiceCatalogItem,
  left: number,
): InvoiceLineForm {
  const billed = rupeesOfPaise(item.price) * row.quantity;
  const discount = row.price !== null && billed > 0 ? (1 - row.price / billed) * 100 : 0;
  return {
    ...lineFromCatalog(item, { qty: left }),
    discountPct: twoPlaces(Math.max(0, Math.min(100, discount))),
    suggestionId: row.id,
  };
}

/** "⚡ Plan · <offering> ×2" (lav): each plan row not yet invoiced nor on the invoice. */
function planPresets(input: InvoiceQuickFillInput, t: TFunction): QuickFillItem[] {
  const { values, catalog, plan, form } = input;
  if (values.type === 'medical') return [];
  const onInvoice = new Set(namedLines(values.items).map((line) => line.offeringId));
  return plan.flatMap((row): QuickFillItem[] => {
    const left = row.quantity - row.invoicedQuantity;
    const item = catalog.byKey.get(row.offeringId);
    if (row.status === 'declined' || left <= 0 || !item || onInvoice.has(item.key)) {
      return [];
    }
    return [
      {
        id: `plan-${row.id}`,
        label:
          left > 1
            ? t(K.planQty, { name: item.label, count: left })
            : t(K.plan, { name: item.label }),
        tone: 'lav',
        onSelect: () =>
          form.setValue(
            'items',
            [...namedLines(form.getValues('items')), planLine(row, item, left)],
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
    return [
      {
        id: `package-${item.key}`,
        label: t(K.package, { name: item.label }),
        tone: item.tone ?? undefined,
        onSelect: () =>
          form.setValue('items', [lineFromCatalog(item)], { shouldDirty: true }),
      },
    ];
  });
}

/**
 * "⚡ Repeat #785" (sky): the patient's last invoice of this type — its offerings still listed
 * here, their quantities and discounts — and its team. The server prices them again.
 */
function repeatPreset(input: InvoiceQuickFillInput, t: TFunction): QuickFillItem[] {
  const { values, catalog, presets, form, invoiceId } = input;
  const last = values.type === 'medical' ? undefined : presets?.lastByType[values.type];
  if (!last || last.id === invoiceId) return [];
  const lines = last.items.flatMap((line) => {
    const item = line.offeringId ? catalog.byKey.get(line.offeringId) : undefined;
    return item
      ? [lineFromCatalog(item, { qty: line.qty, discountPct: line.discountPct })]
      : [];
  });
  if (lines.length === 0) return [];
  return [
    {
      id: 'repeat',
      label: t(K.repeat, { seq: last.seq }),
      tone: 'sky',
      onSelect: () => {
        form.setValue('items', lines, { shouldDirty: true });
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

/** A prescription's medicines as lines — matched by id, else by name; the rest named in a toast. */
export function rxLines(
  rx: InvoiceRxPreset,
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

/**
 * A visit's sessions still to bill as lines (the visit flow's "Create invoice from visit",
 * D156): one line per offering, enough units for its sessions — a package's unit covers several
 * — carrying the sessions it bills (`patient_treatment_ids`). An offering the catalogue doesn't
 * list here (another branch, paused) keeps its session's name; the server says why it can't bill
 * it. The server prices every line.
 */
export function visitLines(
  sessions: readonly TreatmentRecord[],
  catalog: readonly InvoiceCatalogItem[],
): InvoiceLineForm[] {
  const byOffering = new Map<string, TreatmentRecord[]>();
  for (const session of sessions) {
    if (session.offeringId === null) continue;
    byOffering.set(session.offeringId, [
      ...(byOffering.get(session.offeringId) ?? []),
      session,
    ]);
  }
  return [...byOffering].map(([offeringId, billed]) => {
    const item = catalog.find((entry) => entry.key === offeringId);
    const line = item
      ? lineFromCatalog(item)
      : { ...blankLine(), offeringId, name: billed[0]?.name ?? '' };
    return {
      ...line,
      qty: Math.ceil(billed.length / Math.max(1, item?.sessions ?? 1)),
      treatmentIds: billed.map((session) => session.id),
    };
  });
}

/** "⚡ From Rx #500" (sage): the patient's latest prescription, on a Medical sale. */
function rxPreset(input: InvoiceQuickFillInput, t: TFunction): QuickFillItem[] {
  const { values, latestRx: rx, catalog, form } = input;
  if (values.type !== 'medical' || !rx) return [];
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
 * The drawer's Quick fill (H:5066; `payments.md:147`): "Print invoice" for a saved one (peach,
 * also on a read-only drawer — printing is a read), then — for the patient picked — their plan
 * rows still to invoice (lav), the packages they hold, a repeat of their last invoice of this
 * type (sky), a new consultation on a consultation invoice, and their latest Rx on a Medical
 * sale (sage). None saves.
 */
export function useInvoiceQuickFill(input: InvoiceQuickFillInput): QuickFillItem[] {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const print: QuickFillItem[] = input.onPrint
    ? [
        {
          id: 'print',
          label: t(K.print),
          tone: 'peach',
          keepWhenReadOnly: true,
          onSelect: input.onPrint,
        },
      ]
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
