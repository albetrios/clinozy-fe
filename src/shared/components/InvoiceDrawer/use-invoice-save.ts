import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { belowFloor } from '@/shared/api/clinic/clinic-money.ts';
import type { InvoiceSaveResult } from '@/shared/api/clinic/invoices-contracts.ts';
import {
  type DrawerSaveProblem,
  useDrawerSave,
} from '@/shared/hooks/useDrawerSave/index.ts';
import { useCreateInvoice, useUpdateInvoice } from '@/shared/hooks/useInvoices/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { INVOICE_DRAWER_KEYS, INVOICE_DRAWER_NS } from './invoice-drawer.constants.ts';
import type { InvoiceStepId } from './invoice-drawer-view.ts';
import {
  draftFigures,
  type InvoiceFormValues,
  invoiceInputOf,
  type InvoiceLineForm,
  namedLines,
} from './invoice-form.ts';
import type { InvoiceCatalog } from './use-invoice-catalog.ts';

const K = INVOICE_DRAWER_KEYS.errors;

/** The step that holds each field — a check or the server naming one opens it. */
function stepOfField(field: string): InvoiceStepId {
  if (field === 'party' || field === 'teamIds' || field === 'branchId') return 'party';
  if (field.startsWith('items')) return 'items';
  return 'payment';
}

/** The fields in the drawer's order, for "the first one the server named". */
const FIELD_ORDER: readonly FieldPath<InvoiceFormValues>[] = [
  'party',
  'teamIds',
  'items',
  'overallDiscountPct',
  'paidNow',
  'remark',
];

/** The contract's names the form spells differently. */
const SERVER_FIELDS: Readonly<Record<string, FieldPath<InvoiceFormValues>>> = {
  patientId: 'party',
  medicalContactId: 'party',
  leadId: 'party',
  overallDiscount: 'overallDiscountPct',
};

/** Options of {@link useInvoiceSave}. */
export interface UseInvoiceSaveOptions {
  form: UseFormReturn<InvoiceFormValues>;
  /** The saved invoice an edit changes; a new one has none. */
  invoiceId: string | null;
  /** What the invoice has already received — an edit's. */
  alreadyPaid: number;
  /** The branch a new invoice files under when the form has none. */
  fallbackBranchId: string;
  catalog: InvoiceCatalog;
  /** The row's lowest Final (`disc`, Q-U8). */
  floorOf: (row: InvoiceLineForm) => number | null;
  /** The role sees floors (`floor`, Q-U8): the toast names the price. */
  floorVisible: boolean;
  /** Open a step — the one holding the field a check or the server named. */
  onStep: (step: InvoiceStepId) => void;
  onDone: (result: InvoiceSaveResult) => void;
}

/**
 * The Invoice drawer's save (KICKOFF §6.9 Save; H:5064–5065) on the shared
 * drawer save. A missing patient opens its step first (the drawer's steps);
 * then, in the prototype's order: "Add at least one item" (the Items step
 * opens), "Paid ₹X is more than the bill ₹Y",
 * a new sale's stock — "Only 3 of Glycolac Cream in stock" — and a line under
 * its floor — "LHR Full Face · B4G7 is below its lowest price ₹4,000 · raise
 * the final price" (or "… has more discount than allowed · raise the final
 * price or ask an admin"). Then `createInvoice` / `createSale` /
 * `updateInvoice`; a refusal keeps the draft.
 */
export function useInvoiceSave({
  form,
  invoiceId,
  alreadyPaid,
  fallbackBranchId,
  catalog,
  floorOf,
  floorVisible,
  onStep,
  onDone,
}: UseInvoiceSaveOptions) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const create = useCreateInvoice({ notifyOnError: false });
  const update = useUpdateInvoice({ notifyOnError: false });

  const check = (
    values: InvoiceFormValues,
  ): DrawerSaveProblem<InvoiceFormValues> | null => {
    if (namedLines(values.items).length === 0) {
      return { fields: ['items'], message: t(K.addItem) };
    }
    const figures = draftFigures(values, alreadyPaid);
    const paid = alreadyPaid + figures.paidNow;
    if (paid > figures.totals.bill) {
      return {
        fields: ['paidNow'],
        message: t(K.paidAboveBill, {
          paid: formatPaise(paid),
          bill: formatPaise(figures.totals.bill),
        }),
      };
    }
    if (values.type === 'medical' && invoiceId === null) {
      const short = shortStock(values.items, catalog);
      if (short) return { fields: ['items'], message: t(K.stock, short) };
    }
    const index = values.items.findIndex(
      (row) => row.name.trim() !== '' && belowFloor(row, floorOf(row)),
    );
    const row = values.items[index];
    if (row) {
      const floor = floorOf(row) ?? 0;
      return {
        fields: [`items.${index}.discountPct`],
        message: floorVisible
          ? t(K.belowFloor, { name: row.name, amount: formatPaise(Math.round(floor)) })
          : t(K.tooMuchDiscount, { name: row.name }),
      };
    }
    return null;
  };

  return useDrawerSave<InvoiceFormValues, InvoiceSaveResult>({
    form,
    fieldOrder: FIELD_ORDER,
    serverFields: SERVER_FIELDS,
    toastId: 'invoice-save-failed',
    check,
    onField: (field) => onStep(stepOfField(field)),
    write: () => {
      const input = invoiceInputOf(form.getValues(), fallbackBranchId);
      return invoiceId
        ? update.mutateAsync({ id: invoiceId, input })
        : create.mutateAsync(input);
    },
    onDone: (result) => onDone(result),
  });
}

/** The first medicine a new sale asks more of than the store holds: its stock and name. */
function shortStock(
  rows: readonly InvoiceLineForm[],
  catalog: InvoiceCatalog,
): { count: number; name: string } | null {
  const wanted = new Map<string, number>();
  for (const row of rows) {
    if (row.medicineId)
      wanted.set(row.medicineId, (wanted.get(row.medicineId) ?? 0) + row.qty);
  }
  for (const [medicineId, qty] of wanted) {
    const item = catalog.byKey.get(medicineId);
    if (item && item.stock !== null && qty > item.stock) {
      return { count: item.stock, name: item.label };
    }
  }
  return null;
}
