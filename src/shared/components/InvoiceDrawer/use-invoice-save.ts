import type { TFunction } from 'i18next';
import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type {
  InvoiceRecord,
  InvoiceSaveResult,
} from '@/shared/api/app/invoices-contracts.ts';
import { PATIENT_DRAWER_KEYS } from '@/shared/components/PatientDrawer/patient-drawer.constants.ts';
import { apiErrorReason, notifyError } from '@/shared/errors/errorHandler.ts';
import type { HttpError } from '@/shared/errors/HttpError.ts';
import {
  contactFieldsOf,
  emptyContactValue,
} from '@/shared/forms/ContactEditor/index.ts';
import { useCreateContact } from '@/shared/hooks/useContacts/index.ts';
import {
  type DrawerSaveProblem,
  useDrawerSave,
} from '@/shared/hooks/useDrawerSave/index.ts';
import { useCreateInvoice, useUpdateInvoice } from '@/shared/hooks/useInvoices/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { INVOICE_DRAWER_KEYS, INVOICE_DRAWER_NS } from './invoice-drawer.constants.ts';
import type { InvoiceStepId } from './invoice-drawer-view.ts';
import type { InvoiceFigures } from './invoice-figures.ts';
import {
  type InvoiceFormValues,
  invoiceInputOf,
  type InvoiceLineForm,
  namedLines,
  sentLines,
} from './invoice-form.ts';
import {
  type InvoiceSaleWrite,
  saleDraftOf,
  type SaleDraftOutcome,
} from './sale-form.ts';
import type { InvoiceCatalog } from './use-invoice-catalog.ts';
import type { InvoiceDrawerOutcome } from './use-invoice-drawer.ts';

const K = INVOICE_DRAWER_KEYS;

/** The step that holds each field — a check or the server naming one opens it. */
function stepOfField(field: string): InvoiceStepId {
  if (field === 'party' || field === 'teamIds' || field === 'branchId') return 'party';
  if (field.startsWith('items')) return 'items';
  return 'payment';
}

/** The contract's names the form spells differently — a sale's among them. */
const SERVER_FIELDS: Readonly<Record<string, FieldPath<InvoiceFormValues>>> = {
  contactId: 'party',
  patientId: 'party',
  patientPrescriptionId: 'party',
  memberIds: 'teamIds',
  phones: 'party',
  invoiceDate: 'date',
  payment: 'paidNow',
  'payment.splits': 'paidNow',
};

/**
 * The server's names for an invoice's lines, on the rows they came from: `items/<n>` counts the
 * lines sent — the rows with an offering — so it lands on the n-th of those, on its Disc %.
 */
function lineServerFields(
  rows: readonly InvoiceLineForm[],
): Record<string, FieldPath<InvoiceFormValues>> {
  const fields: Record<string, FieldPath<InvoiceFormValues>> = {};
  for (const [index, { row }] of sentLines(rows).entries()) {
    fields[`items.${index}`] = `items.${row}.discountPct`;
    fields[`items.${index}.discountPercent`] = `items.${row}.discountPct`;
    fields[`items.${index}.quantity`] = `items.${row}.qty`;
  }
  return fields;
}

/** The fields in the drawer's order, each row's in turn — a server error opens the first. */
function fieldOrderOf(rows: readonly InvoiceLineForm[]): FieldPath<InvoiceFormValues>[] {
  return [
    'party',
    'teamIds',
    'items',
    ...rows.flatMap((_row, index): FieldPath<InvoiceFormValues>[] => [
      `items.${index}.offeringId`,
      `items.${index}.qty`,
      `items.${index}.discountPct`,
    ]),
    'overallDiscountPct',
    'overallDiscount',
    'paidNow',
    'remark',
  ];
}

/**
 * Why clinozy-be refuses a bill or a change (`409`, a stale save aside), in the screen's words,
 * and the field each goes on: "Paid now" above the bill or on a closed day, a settled invoice, a
 * total under what is paid, a used session, a treatment billed meanwhile, a Medical sale's.
 */
const CONFLICTS: ReadonlyMap<
  string,
  { key: string; field?: FieldPath<InvoiceFormValues>; step?: InvoiceStepId }
> = new Map([
  ['more_than_due', { key: K.refusals.moreThanDue, field: 'paidNow', step: 'payment' }],
  ['day_closed', { key: K.refusals.dayClosed, field: 'paidNow', step: 'payment' }],
  ['invoice_settled', { key: K.refusals.settled }],
  ['below_paid', { key: K.refusals.belowPaid, step: 'items' }],
  ['offering_in_use', { key: K.refusals.offeringInUse, step: 'items' }],
  ['treatment_billed', { key: K.refusals.treatmentBilled, step: 'items' }],
  ['invoice_of_sale', { key: K.refusals.ofSale }],
]);

/**
 * What a party with no contact yet still lacks, as a message key: an invoice's patient still
 * being read — or a sale's new customer, whose contact the save writes once it has a mobile.
 */
function partyProblem(party: InvoiceFormValues['party'], sale: boolean): string | null {
  if (party?.contactId !== null) return null;
  if (!sale) return K.errors.pickPatient;
  if (party.kind !== 'contact') return K.errors.pickCustomer;
  return party.phone ? null : PATIENT_DRAWER_KEYS.mobileInvalid;
}

/** Options of {@link useInvoiceSave}. */
export interface UseInvoiceSaveOptions {
  form: UseFormReturn<InvoiceFormValues>;
  /** The saved invoice an edit changes, as last read; a new one has none. */
  invoice: InvoiceRecord | null;
  /** A Medical sale, not an invoice. */
  sale: boolean;
  /** The Medical room's write for a sale (`POST /app/medical-sales`); none outside New sale. */
  saleWrite: InvoiceSaleWrite | null;
  /** The branch a new invoice files under when the form has none. */
  fallbackBranchId: string;
  catalog: InvoiceCatalog;
  figures: InvoiceFigures;
  /** The rows the server's preview refused, each under its lowest price. */
  refusedRows: readonly number[];
  /** The member sees the lowest price: the refusal names it. */
  floorVisible: boolean;
  /** Open a step — the one holding the field a check or the server named. */
  onStep: (step: InvoiceStepId) => void;
  /** Read the invoice again after a stale save (`409 record_changed`). */
  onStale?: () => void;
  onDone: (outcome: InvoiceDrawerOutcome) => void;
}

/** A written sale as the drawer's outcome: its invoice, numbered as the sale. */
const saleOutcomeOf = (sale: SaleDraftOutcome): InvoiceDrawerOutcome => ({
  invoiceId: sale.invoiceId,
  seq: sale.seq,
  type: 'medical',
  planLinked: 0,
});

/** A save's answer as the drawer's outcome. */
function outcomeOf(result: InvoiceSaveResult): InvoiceDrawerOutcome {
  const { invoice } = result.detail;
  return {
    invoiceId: invoice.id,
    seq: invoice.seq,
    type: invoice.type,
    planLinked: result.planLinked,
  };
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

/** "Under its lowest price" for a refused row — with the price for a member who may see it. */
export function belowLowestMessage({
  row,
  catalog,
  floorVisible,
  t,
  formatRupees,
  inCell,
}: {
  row: InvoiceLineForm;
  catalog: InvoiceCatalog;
  floorVisible: boolean;
  t: TFunction;
  formatRupees: (rupees: number) => string;
  /** The cell's tooltip, else the save's toast. */
  inCell: boolean;
}): string {
  const floor = row.offeringId ? catalog.offerings.get(row.offeringId)?.minPrice : null;
  if (floorVisible && floor) {
    const amount = formatRupees(floor);
    return t(inCell ? K.items.belowFloor : K.errors.belowFloor, {
      name: row.name,
      amount,
    });
  }
  return t(inCell ? K.items.belowLowest : K.errors.belowLowest, { name: row.name });
}

/**
 * The Invoice drawer's save (KICKOFF §6.9 Save; H:5064–5065) on the shared drawer save. A
 * missing patient opens its step first (the drawer's steps); then "Add at least one item" (the
 * Items step opens), a new customer's mobile, "Paid ₹X is more than the bill ₹Y" (an invoice's
 * bill is the server's preview), a new sale's stock — "Only 3 of Glycolac Cream in stock" — and
 * a line the preview found under its lowest price. Then `POST /app/invoices` (with "Paid now"),
 * `PATCH /app/invoices/:id` (what changed, with the read's `updated_at`) or the Medical room's
 * sale write (a new customer's contact saved first, `POST /app/contacts`); a refusal keeps the
 * draft: a field the server names goes on its field (`items/<n>` on its row), a `409` reason is
 * said in the screen's words — or the server's (`not_enough_stock`, `prescription_filled`) — a
 * stale save offers "Reload".
 */
export function useInvoiceSave({
  form,
  invoice,
  sale,
  saleWrite,
  fallbackBranchId,
  catalog,
  figures,
  refusedRows,
  floorVisible,
  onStep,
  onStale,
  onDone,
}: UseInvoiceSaveOptions) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const formatRupees = useRupeeFormat();
  const create = useCreateInvoice({ notifyOnError: false });
  const update = useUpdateInvoice({ notifyOnError: false });
  const createContact = useCreateContact({ notifyOnError: false });
  const rows = form.getValues('items');

  const check = (
    values: InvoiceFormValues,
  ): DrawerSaveProblem<InvoiceFormValues> | null => {
    const billed = sale ? namedLines(values.items) : sentLines(values.items);
    if (billed.length === 0) return { fields: ['items'], message: t(K.errors.addItem) };
    const party = partyProblem(values.party, sale);
    if (party) return { fields: ['party'], message: t(party) };
    const paid = figures.paidBefore + figures.paidNow;
    if (figures.status === 'ready' && figures.paidNow > figures.dueBefore) {
      return {
        fields: ['paidNow'],
        message: t(K.errors.paidAboveBill, {
          paid: formatPaise(paid),
          bill: formatPaise(figures.bill),
        }),
      };
    }
    const short = sale ? shortStock(values.items, catalog) : null;
    if (short) return { fields: ['items'], message: t(K.errors.stock, short) };
    const refused = refusedRows[0];
    const row = refused === undefined ? undefined : values.items[refused];
    if (refused === undefined || !row) return null;
    return {
      fields: [`items.${refused}.discountPct`],
      message: belowLowestMessage({
        row,
        catalog,
        floorVisible,
        t,
        formatRupees,
        inCell: false,
      }),
    };
  };

  const onConflict = (error: HttpError) => {
    const conflict = CONFLICTS.get(apiErrorReason(error) ?? '');
    if (!conflict) {
      notifyError(error);
      return;
    }
    const message = t(conflict.key);
    if (conflict.field) form.setError(conflict.field, { type: 'server', message });
    if (conflict.step) onStep(conflict.step);
    notify.error(message);
  };

  /** The buyer's contact — a new customer's saved first, and kept on the form for a retry. */
  const buyerContactOf = async (values: InvoiceFormValues): Promise<string> => {
    const party = values.party;
    if (party?.contactId) return party.contactId;
    if (party?.kind !== 'contact')
      throw new Error('invoice drawer: a sale needs its buyer');
    const contact = await createContact.mutateAsync(
      contactFieldsOf(emptyContactValue(party.name, party.phone)),
    );
    form.setValue('party', { ...party, id: contact.id, contactId: contact.id });
    return contact.id;
  };

  const write = async (): Promise<InvoiceDrawerOutcome> => {
    const values = form.getValues();
    if (sale) {
      // Outside New sale (no room's write) a Medical invoice has nowhere to go (MD28).
      if (!saleWrite)
        throw new Error('invoice drawer: a sale needs the Medical room’s write');
      const contactId = await buyerContactOf(values);
      return saleOutcomeOf(
        await saleWrite.create(saleDraftOf(values, { contactId, fallbackBranchId })),
      );
    }
    const input = invoiceInputOf(values, fallbackBranchId);
    const result = invoice
      ? await update.mutateAsync({ invoice, input })
      : await create.mutateAsync(input);
    return outcomeOf(result);
  };

  return useDrawerSave<InvoiceFormValues, InvoiceDrawerOutcome>({
    form,
    fieldOrder: fieldOrderOf(rows),
    serverFields: { ...SERVER_FIELDS, ...lineServerFields(rows) },
    toastId: 'invoice-save-failed',
    check,
    onConflict,
    onStale,
    onField: (field) => onStep(stepOfField(field)),
    write,
    onDone: (outcome) => onDone(outcome),
  });
}
