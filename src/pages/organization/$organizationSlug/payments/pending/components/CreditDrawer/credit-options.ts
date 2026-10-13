import type { TFunction } from 'i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { CreditPartyRow } from '@/shared/api/app/credits-contracts.ts';
import type { InvoiceRecord } from '@/shared/api/app/invoices-contracts.ts';
import { formatAppPhone } from '@/shared/app/app-phone.ts';
import { personInitials } from '@/shared/components/Cells/index.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';

import { PAYMENTS_KEYS } from '../../../payments.constants.ts';
import { type CreditParty, partyOf } from './credit-form.ts';

const K = PAYMENTS_KEYS.credit;

/** The key "No invoice" holds in the For invoice picker. */
export const NO_INVOICE = 'none';

/** A party's line under its name: "Patient · #3441", "Contact · +91 …", "Clinic vendor". */
function partySub(row: CreditPartyRow, t: TFunction): string {
  if (row.kind === 'patient')
    return t(K.parties.patient, { id: isolateText(displayId.patient(row.seq)) });
  if (row.kind === 'contact') {
    return row.phone
      ? t(K.parties.contactPhone, { phone: isolateText(formatAppPhone(row.phone)) })
      : t(K.parties.contact);
  }
  return t(row.kind === 'vendor' ? K.parties.vendor : K.parties.supplier);
}

/** The group a party is listed under: Patients · Contacts · Suppliers & vendors. */
function partyGroup(row: CreditPartyRow, t: TFunction): string {
  if (row.kind === 'patient') return t(K.groups.patients);
  if (row.kind === 'contact') return t(K.groups.contacts);
  return t(K.groups.suppliers);
}

/**
 * One row of the Who picker (`payments.md:157`; H:4024): a patient on its
 * avatar with the "P" badge, a contact on a plain one, a supplier on a dot —
 * each under its group, keyed as the form keeps it.
 */
export function creditPartyOption(
  row: CreditPartyRow,
  t: TFunction,
): PickerOption<CreditPartyRow> {
  const base = {
    key: partyOf(row).key,
    label: row.name,
    sub: partySub(row, t),
    group: partyGroup(row, t),
    data: row,
  };
  if (row.kind === 'patient') {
    return {
      ...base,
      tone: 'sage',
      leading: { kind: 'avatar', initials: personInitials(row.name), patient: true },
    };
  }
  if (row.kind === 'contact') {
    return {
      ...base,
      tone: 'mint',
      leading: { kind: 'avatar', initials: personInitials(row.name) },
    };
  }
  return { ...base, tone: 'stone' };
}

/**
 * The picked party as the trigger shows it before its page has loaded: a person on their avatar
 * (a patient with the "P" badge), a supplier on a dot.
 */
export function pickedPartyOption(party: CreditParty): PickerOption<CreditPartyRow> {
  if (party.contactId === null)
    return { key: party.key, label: party.name, tone: 'stone' };
  return {
    key: party.key,
    label: party.name,
    tone: party.patientId ? 'sage' : 'mint',
    leading: {
      kind: 'avatar',
      initials: personInitials(party.name),
      patient: party.patientId !== null,
    },
  };
}

/**
 * The For invoice picker (`payments.md:160`): "No invoice", then the person's
 * invoices newest first — "Invoice #772", "₹1,000 · ₹600 due" or "₹1,534 ·
 * paid" (the server's total and due), the day at the end.
 */
export function invoiceOptions({
  invoices,
  t,
  formatRupees,
  formatDay,
}: {
  invoices: readonly InvoiceRecord[];
  t: TFunction;
  formatRupees: (rupees: number) => string;
  formatDay: (day: string) => string;
}): PickerOption[] {
  return [
    { key: NO_INVOICE, label: t(K.noInvoice), tone: 'lav' },
    ...invoices.map((invoice): PickerOption => ({
      key: invoice.id,
      label: t(PAYMENTS_KEYS.pending.invoice, { seq: invoice.seq }),
      sub:
        invoice.due > 0
          ? t(K.invoiceDue, {
              bill: formatRupees(invoice.total),
              due: formatRupees(invoice.due),
            })
          : t(K.invoicePaid, { bill: formatRupees(invoice.total) }),
      meta: formatDay(invoice.date),
      tone: 'lav',
    })),
  ];
}
