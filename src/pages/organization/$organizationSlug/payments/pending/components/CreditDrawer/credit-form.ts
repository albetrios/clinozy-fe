import { MONEY_SCALE, numberFromText, textFromNumber } from '@/lib/number-text.ts';
import type { CreditDirection, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import {
  CREDIT_REASON_VALUES,
  type CreditInput,
  type CreditPartyRow,
  type CreditReasonKey,
  type CreditRow,
} from '@/shared/api/clinic/credits-contracts.ts';

/*
 * Add pending / Edit pending's form (`payments.md:152–168`; H:4022–4034) —
 * pure, so the drawer, its steps' heads, its footer and its checks read one
 * set of rules.
 */

/**
 * Who the credit is with: a patient by id, or anyone by name — a contact, a
 * supplier, or a name typed in ("Add “q”"). The key is the picker's: a
 * patient's id, else the name, so a typed name and a listed one are the same
 * pick (the prototype matches by name).
 */
export interface CreditParty {
  key: string;
  name: string;
  patientId: string | null;
}

/** The drawer's form — the amount in rupees as typed ("500", "12.5"), Settle by as `YYYY-MM-DD`. */
export interface CreditFormValues {
  direction: CreditDirection;
  party: CreditParty | null;
  amount: string;
  reasonKey: CreditReasonKey | null;
  invoiceId: string | null;
  settleBy: string | null;
  note: string;
}

/** The typed amount in paise; empty is 0. */
export const creditAmount = (values: Pick<CreditFormValues, 'amount'>) =>
  numberFromText(values.amount, MONEY_SCALE);

/**
 * A party picked by name: its key is the name in lower case, every run of
 * other characters a hyphen ("name:medline-surgicals") — it names the option's
 * test id too.
 */
export function partyByName(name: string): CreditParty {
  const trimmed = name.trim();
  const slug = trimmed
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/(?:^-)|(?:-$)/g, '');
  return { key: `name:${slug}`, name: trimmed, patientId: null };
}

/** A row of the Who picker as the form keeps it. */
export function partyOf(row: CreditPartyRow): CreditParty {
  if (row.kind === 'patient')
    return { key: `patient:${row.id}`, name: row.name, patientId: row.id };
  return partyByName(row.name);
}

/** A new credit: the way the link names, Give by default (H:4022), nothing else filled. */
export function emptyCreditForm(direction: CreditDirection = 'give'): CreditFormValues {
  return {
    direction,
    party: null,
    amount: '',
    reasonKey: null,
    invoiceId: null,
    settleBy: null,
    note: '',
  };
}

/**
 * An open credit as its edit form. A seeded credit's reason is free text with
 * no chip: it opens on "Other" with that text as the note, so a save keeps it
 * (the stored reason is the chip's label, or the note for "Other" — D22).
 */
export function creditFormOf(credit: CreditRow): CreditFormValues {
  const freeText = credit.reasonKey === null;
  return {
    direction: credit.direction,
    party: credit.patientId
      ? {
          key: `patient:${credit.patientId}`,
          name: credit.partyName,
          patientId: credit.patientId,
        }
      : partyByName(credit.partyName),
    amount: textFromNumber(credit.amount, MONEY_SCALE),
    reasonKey: freeText ? 'other' : credit.reasonKey,
    invoiceId: credit.invoiceId,
    settleBy: credit.settleBy,
    note: (freeText ? (credit.note ?? credit.reason) : credit.note) ?? '',
  };
}

/** Another way: its own reasons, so the picked one goes (`payments.md:156`). */
export function withDirection(
  values: CreditFormValues,
  direction: CreditDirection,
): CreditFormValues {
  if (direction === values.direction) return values;
  return { ...values, direction, reasonKey: null };
}

/** Another party: an invoice belongs to a patient, so the picked one goes. */
export function withParty(
  values: CreditFormValues,
  party: CreditParty | null,
): CreditFormValues {
  if (party?.key === values.party?.key) return values;
  return { ...values, party, invoiceId: null };
}

/** The reason chips of a way, in the design's order (`payments.md:159`). */
export function reasonsOf(direction: CreditDirection): readonly CreditReasonKey[] {
  return CREDIT_REASON_VALUES[direction];
}

/** The reason chips' tones, by position (H:4031: butter, sky, lav, blush, mint, stone). */
const REASON_TONES = [
  'butter',
  'sky',
  'lav',
  'blush',
  'mint',
  'stone',
] as const satisfies readonly Tone[];

/** A reason chip's tone: its position in its way's list picks it. */
export function reasonTone(direction: CreditDirection, reason: CreditReasonKey): Tone {
  const index = Math.max(0, reasonsOf(direction).indexOf(reason));
  return REASON_TONES[index % REASON_TONES.length] ?? 'stone';
}

/** What stops a save, in the drawer's order, and the field it names (`payments.md:164`). */
export type CreditProblem =
  | { kind: 'who'; field: 'party' }
  | { kind: 'amount'; field: 'amount' }
  | { kind: 'reason'; field: 'reasonKey' }
  | { kind: 'otherNote'; field: 'note' };

/**
 * The checks in the order the design runs them (H:4033): who, then an amount
 * above zero, then a reason, then a note for "Other".
 */
export function creditProblem(values: CreditFormValues): CreditProblem | null {
  if (!values.party?.name.trim()) return { kind: 'who', field: 'party' };
  if (creditAmount(values) <= 0) return { kind: 'amount', field: 'amount' };
  if (!values.reasonKey) return { kind: 'reason', field: 'reasonKey' };
  if (values.reasonKey === 'other' && !values.note.trim())
    return { kind: 'otherNote', field: 'note' };
  return null;
}

/** What Add / Edit pending sends (`create/update PendingCredit`, `S:1712`). */
export function creditInputOf(values: CreditFormValues): CreditInput {
  return {
    direction: values.direction,
    partyName: values.party?.name.trim() ?? '',
    patientId: values.party?.patientId ?? null,
    amount: creditAmount(values),
    // creditProblem has run: a reason is picked.
    reasonKey: values.reasonKey ?? 'other',
    invoiceId: values.party?.patientId ? values.invoiceId : null,
    settleBy: values.settleBy,
    note: values.note.trim() || null,
  };
}
