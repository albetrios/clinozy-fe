import { displayId } from './clinic-display-id.ts';
import { createdFilterMatches } from './clinic-filter-match.ts';
import {
  clinicHttpError,
  compareText,
  type CreateInput,
  type CursorPage,
  refuseUnknownIds,
  validateClinicInput,
} from './clinic-fixture-store.ts';
import { invoiceBalance } from './clinic-money.ts';
import type { DeleteReason } from './clinic-schema.ts';
import { clinicInstant, clinicToday } from './clinic-time.ts';
import { COMMAND_SEARCH_PER_TYPE } from './command-search-api.ts';
import {
  type CreditInput,
  creditInputSchema,
  type CreditListParams,
  type CreditPartyRow,
  type CreditReasonKey,
  type CreditRow,
  type CreditSettlement,
  type CreditSettleResult,
  type PendingCreditRecord,
} from './credits-contracts.ts';
import { assertDayOpen } from './day-close-api.ts';
import { isLeadNotPatient } from './patient-search-api.ts';
import { listPatients } from './patients-api.ts';
import { patientName } from './patients-contracts.ts';
import type { PaymentRecord } from './payments-contracts.ts';
import { createTask } from './tasks-api.ts';

/*
 * Payments › Pending's reads and writes (`S:1700`, `S:1712–1713`), on the
 * fixture world until clinozy-be serves them — every call is REPLACE_WITH_API
 * (D6). The world is imported on demand, so its seed data never lands in a
 * route chunk. A settlement writes its ledger entry here too, as the server's
 * `settleCredit` does.
 */

/** TanStack Query keys for the credits — all under `['clinic', 'credits']`. */
export const creditQueryKeys = {
  all: ['clinic', 'credits'] as const,
  /** Every Pending variant — a write invalidates them all. */
  lists: () => [...creditQueryKeys.all, 'list'] as const,
  list: (params: CreditListParams) => [...creditQueryKeys.lists(), params] as const,
  detail: (id: string) => [...creditQueryKeys.all, 'detail', id] as const,
  /** Add pending's Who picker — its pages, by the text searched. */
  parties: () => [...creditQueryKeys.all, 'parties'] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');
const fixtureStaff = () => import('./fixtures/staff.fixtures.ts');

type FixtureWorld = Awaited<ReturnType<typeof fixtureWorld>>['clinicFixtures'];

/**
 * The stored `reason` of each chip — the server's text, in English (D22; the
 * screens show the chip's own label, `payments.md:159`).
 */
const REASON_TEXT: Readonly<Record<Exclude<CreditReasonKey, 'other'>, string>> = {
  charged_twice: 'Charged twice',
  advance_not_used: 'Advance not used',
  package_cancelled: 'Package cancelled',
  overpaid: 'Overpaid',
  returned_items: 'Returned items',
  short_payment: 'Short payment',
  damaged_goods: 'Damaged goods returned',
  advance_given: 'Advance given',
  loan_to_staff: 'Loan to staff',
};

/** The settle-by task's title — server-written text (Appendix F). */
const SETTLE_TASK_TITLE = { give: 'Give back', take: 'Get back' } as const;

const NOT_OPEN = 'This pending is already settled';
const ENTER_AMOUNT = 'Enter the amount';
const MORE_THAN_OWED = 'More than what is owed';
const NOTHING_DUE = 'Nothing due to adjust against';

// ── Joins (the fixture server's) ──

function toCreditRow(credit: PendingCreditRecord, world: FixtureWorld): CreditRow {
  const patient = credit.patientId
    ? world.patients.snapshot((row) => row.id === credit.patientId)[0]
    : undefined;
  const source = credit.sourcePaymentId
    ? world.payments.snapshot((row) => row.id === credit.sourcePaymentId)[0]
    : undefined;
  const invoice = credit.invoiceId
    ? world.invoices.snapshot((row) => row.id === credit.invoiceId)[0]
    : undefined;
  return {
    ...credit,
    patientSeq: patient?.seq ?? null,
    source: source
      ? { seq: source.seq, direction: source.direction, kind: source.kind }
      : null,
    invoiceSeq: invoice?.seq ?? null,
    settledInvoiceSeq: credit.status === 'used' ? settledInvoiceSeq(credit, world) : null,
  };
}

/** The invoice the entry that settled a credit went to — a use on the next bill's (Q-G9). */
function settledInvoiceSeq(
  credit: PendingCreditRecord,
  world: FixtureWorld,
): number | null {
  const entry = credit.settledPaymentId
    ? world.payments.snapshot((row) => row.id === credit.settledPaymentId)[0]
    : undefined;
  const invoice = entry?.invoiceId
    ? world.invoices.snapshot((row) => row.id === entry.invoiceId)[0]
    : undefined;
  return invoice?.seq ?? null;
}

// ── Search and filters (the fixture server's) ──

const squeeze = (text: string) => text.toLowerCase().replace(/[\s#·-]/g, '');

/** Whether a credit matches `q`: "CR-2", the party or the reason. */
function matchesSearch(credit: PendingCreditRecord, query: string): boolean {
  const needle = squeeze(query);
  if (!needle) return true;
  return [
    displayId.pendingCredit(credit.seq),
    credit.partyName,
    credit.reason,
    credit.note ?? '',
  ]
    .map(squeeze)
    .some((field) => field.includes(needle));
}

// ── Reads ──

/**
 * One cursor page of credits (`listPendingCredits`, `S:1700`;
 * REPLACE_WITH_API): filtered by which way, state, Created and `q`, the
 * newest number first — the order credits were added in (H:5091; the seed's
 * "Since" days are not in that order). Each row names its patient, source entry
 * and invoice.
 */
export async function listPendingCredits(
  params: CreditListParams = {},
  cursor: string | null = null,
): Promise<CursorPage<CreditRow>> {
  const { clinicFixtures } = await fixtureWorld();
  const today = clinicToday();
  const page = await clinicFixtures.pendingCredits.list({
    where: (credit) =>
      (!params.direction?.length || params.direction.includes(credit.direction)) &&
      (!params.status?.length || params.status.includes(credit.status)) &&
      (!params.created ||
        createdFilterMatches(credit.createdAt, params.created, today)) &&
      matchesSearch(credit, params.q ?? ''),
    sort: (a, b) => b.seq - a.seq,
    cursor,
  });
  return {
    items: page.items.map((credit) => toCreditRow(credit, clinicFixtures)),
    nextCursor: page.nextCursor,
  };
}

const nameKey = (name: string) => name.trim().toLowerCase();

/** Whether a party matches the Who search: its name, or (three digits or more) its phone. */
function partyMatches(name: string, phone: string | null, query: string): boolean {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  const digits = text.replace(/\D/g, '');
  return (
    name.toLowerCase().includes(text) ||
    (digits.length >= 3 && !!phone && phone.replace(/\D/g, '').includes(digits))
  );
}

/**
 * The contacts and suppliers `query` finds (`payments.md:157`): the leads that
 * never became patients and the Medical walk-ins, then the Clinic stock
 * vendors and the Medical suppliers — ten of each group, each name once, and
 * never a patient's name (the Patients group has them).
 */
async function partiesBeyondPatients(query: string): Promise<CreditPartyRow[]> {
  const { clinicFixtures } = await fixtureWorld();
  const seen = new Set(
    clinicFixtures.patients.snapshot().map((patient) => nameKey(patientName(patient))),
  );
  const firstTime = (name: string) => {
    if (seen.has(nameKey(name))) return false;
    seen.add(nameKey(name));
    return true;
  };
  const contacts: CreditPartyRow[] = [
    ...clinicFixtures.leads
      .snapshot((lead) => isLeadNotPatient(lead))
      .sort((a, b) => b.seq - a.seq)
      .map((lead) => ({ id: lead.id, name: lead.name, phone: lead.phone })),
    ...clinicFixtures.medicalContacts
      .snapshot()
      .map((contact) => ({ id: contact.id, name: contact.name, phone: contact.phone })),
  ]
    .filter(
      (party) => partyMatches(party.name, party.phone, query) && firstTime(party.name),
    )
    .slice(0, COMMAND_SEARCH_PER_TYPE)
    .map((party) => ({ kind: 'contact', ...party }));
  const suppliers: CreditPartyRow[] = [
    ...clinicFixtures.stockVendors
      .snapshot()
      .map((vendor) => ({ kind: 'vendor' as const, vendor })),
    ...clinicFixtures.suppliers
      .snapshot()
      .map((supplier) => ({ kind: 'supplier' as const, vendor: supplier })),
  ]
    .filter(
      ({ vendor }) =>
        partyMatches(vendor.name, vendor.phone, query) && firstTime(vendor.name),
    )
    .slice(0, COMMAND_SEARCH_PER_TYPE)
    .map(({ kind, vendor }) => ({ kind, id: vendor.id, name: vendor.name }));
  return [...contacts, ...suppliers];
}

/**
 * One page of Add pending's Who picker (`payments.md:157`; REPLACE_WITH_API):
 * patients A–Z by name, mobile or id (`listPatients`, `S:1619`) — all of them
 * for an empty search — then, on the last page, the contacts and the suppliers
 * the same text finds.
 */
export async function searchCreditParties(
  query: string,
  cursor: string | null = null,
): Promise<CursorPage<CreditPartyRow>> {
  const text = query.trim();
  const page = await listPatients(
    { q: text || undefined, sort: 'name', order: 'asc' },
    cursor,
  );
  const patients: CreditPartyRow[] = page.items.map((row) => ({
    kind: 'patient',
    id: row.id,
    seq: row.seq,
    name: patientName(row),
    phone: row.phone,
  }));
  const others = page.nextCursor === null ? await partiesBeyondPatients(text) : [];
  return { items: [...patients, ...others], nextCursor: page.nextCursor };
}

/** One credit (REPLACE_WITH_API) — a 404 when it is unknown or deleted. */
export async function fetchCredit(id: string): Promise<CreditRow> {
  const { clinicFixtures } = await fixtureWorld();
  return toCreditRow(await clinicFixtures.pendingCredits.get(id), clinicFixtures);
}

// ── Writes ──

/** The stored reason: the chip's text, or the note for "Other" (D22). */
function reasonOf(input: CreditInput): string {
  if (input.reasonKey === 'other') return input.note?.trim() ?? '';
  return REASON_TEXT[input.reasonKey];
}

/** Refuse what the server refuses: an unknown patient, an invoice not theirs. */
function checkCredit(world: FixtureWorld, fields: CreditInput): void {
  if (fields.patientId) {
    refuseUnknownIds(
      'patientId',
      [fields.patientId],
      world.patients.snapshot(),
      'Pick who',
    );
  }
  if (fields.invoiceId) {
    const invoice = world.invoices.snapshot((row) => row.id === fields.invoiceId)[0];
    if (!invoice || invoice.patientId !== fields.patientId) {
      throw clinicHttpError(422, 'validation', 'Pick one of this patient’s invoices', {
        invoiceId: ['Pick one of this patient’s invoices'],
      });
    }
  }
}

/** "Settle by" opens a task due that day, at the start of the clinic's day (Appendix F). */
async function openSettleTask(credit: PendingCreditRecord): Promise<void> {
  if (!credit.settleBy) return;
  const { FIXTURE_VIEWER_ID } = await fixtureStaff();
  await createTask({
    title: `${SETTLE_TASK_TITLE[credit.direction]} · ${displayId.pendingCredit(credit.seq)}`,
    why: `${credit.partyName} · ${credit.reason}`,
    ownerId: FIXTURE_VIEWER_ID,
    patientId: credit.patientId,
    dueAt: clinicInstant(credit.settleBy, '10:00'),
  });
}

/**
 * Add pending (`create PendingCredit`, `S:1712`; REPLACE_WITH_API): which way,
 * who, the amount and the reason — the chip's text, or the note for "Other" —
 * with the plan's For invoice, Settle by (a task due then) and Note.
 */
export async function createCredit(input: CreditInput): Promise<PendingCreditRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(creditInputSchema, input);
  checkCredit(clinicFixtures, fields);
  const credit = await clinicFixtures.pendingCredits.create({
    direction: fields.direction,
    partyName: fields.partyName,
    patientId: fields.patientId,
    amount: fields.amount,
    reason: reasonOf(fields),
    sourcePaymentId: null,
    status: 'open',
    settledPaymentId: null,
    reasonKey: fields.reasonKey,
    note: fields.note === '' ? null : fields.note,
    invoiceId: fields.invoiceId,
    settleBy: fields.settleBy,
    adjusted: 0,
    settledAt: null,
  });
  await openSettleTask(credit);
  return credit;
}

/** Refuse a change to a credit that is no longer open (`S:90`). */
function assertOpen(credit: PendingCreditRecord): void {
  if (credit.status !== 'open') throw clinicHttpError(409, 'conflict', NOT_OPEN);
}

/**
 * Edit pending (`update PendingCredit`, `S:1712`; REPLACE_WITH_API): only while
 * it is open (409 after); the amount never below what is already settled.
 */
export async function updateCredit(
  id: string,
  input: CreditInput,
): Promise<PendingCreditRecord> {
  const { clinicFixtures } = await fixtureWorld();
  const saved = await clinicFixtures.pendingCredits.get(id);
  assertOpen(saved);
  const fields = validateClinicInput(creditInputSchema, input);
  checkCredit(clinicFixtures, fields);
  if (fields.amount < saved.adjusted) {
    throw clinicHttpError(422, 'validation', 'Less than what is already settled', {
      amount: ['Less than what is already settled'],
    });
  }
  const credit = await clinicFixtures.pendingCredits.update(id, {
    direction: fields.direction,
    partyName: fields.partyName,
    patientId: fields.patientId,
    amount: fields.amount,
    reason: reasonOf(fields),
    reasonKey: fields.reasonKey,
    note: fields.note === '' ? null : fields.note,
    invoiceId: fields.invoiceId,
    settleBy: fields.settleBy,
  });
  if (fields.settleBy && fields.settleBy !== saved.settleBy) await openSettleTask(credit);
  return credit;
}

/** Soft-delete a credit with the confirm's reason (`S:1546`; REPLACE_WITH_API). */
export async function deleteCredit(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<PendingCreditRecord> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.pendingCredits.remove(id, reason, note);
}

/** Put a deleted credit back — the Undo of its "deleted" toast (`POST …/restore`, D32). */
export async function restoreCredit(id: string): Promise<PendingCreditRecord> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.pendingCredits.restore(id);
}

/**
 * The invoice a patient's money goes back against: the credit's own, else the
 * one its source entry was for (the prototype's `src.inv`, H:4037).
 */
function creditInvoiceId(
  credit: PendingCreditRecord,
  world: FixtureWorld,
): string | null {
  if (credit.invoiceId) return credit.invoiceId;
  const source = credit.sourcePaymentId
    ? world.payments.snapshot((row) => row.id === credit.sourcePaymentId)[0]
    : undefined;
  return source?.invoiceId ?? null;
}

/** The ledger entry a give-back or a get-back writes, by who the party is. */
function settlementEntry(
  credit: PendingCreditRecord,
  action: 'give_back' | 'got_back',
  invoiceId: string | null,
): Pick<
  CreateInput<PaymentRecord>,
  'direction' | 'kind' | 'patientId' | 'payeeName' | 'expenseCategory' | 'invoiceId'
> {
  const patient = credit.patientId !== null;
  if (action === 'give_back') {
    return patient
      ? {
          direction: 'paid',
          kind: 'refund',
          patientId: credit.patientId,
          payeeName: null,
          expenseCategory: null,
          invoiceId,
        }
      : {
          direction: 'paid',
          kind: 'expense',
          patientId: null,
          payeeName: credit.partyName,
          expenseCategory: 'misc',
          invoiceId: null,
        };
  }
  return patient
    ? {
        direction: 'received',
        kind: 'receipt',
        patientId: credit.patientId,
        payeeName: null,
        expenseCategory: null,
        invoiceId,
      }
    : {
        direction: 'received',
        kind: 'money_back',
        patientId: null,
        payeeName: credit.partyName,
        expenseCategory: null,
        invoiceId: null,
      };
}

/** The patient's oldest invoice with a due (Q-G9), or none. */
function oldestDueInvoice(world: FixtureWorld, patientId: string) {
  const payments = world.payments.snapshot();
  return world.invoices
    .snapshot((invoice) => invoice.patientId === patientId)
    .map((invoice) => ({ invoice, due: invoiceBalance(invoice, payments).due }))
    .filter(({ due }) => due > 0)
    .sort(
      (a, b) =>
        compareText(a.invoice.date, b.invoice.date) || a.invoice.seq - b.invoice.seq,
    )[0];
}

/** A new ledger entry for a settlement, with every field the contract keeps. */
function settlementPayment(
  credit: PendingCreditRecord,
  fields: Pick<
    CreateInput<PaymentRecord>,
    | 'direction'
    | 'kind'
    | 'patientId'
    | 'payeeName'
    | 'expenseCategory'
    | 'invoiceId'
    | 'amount'
    | 'splits'
  >,
  branchId: string,
  creditNoteId: string | null,
): CreateInput<PaymentRecord> {
  return {
    ...fields,
    branchId,
    billRef: null,
    creditNoteId,
    pendingCreditId: credit.id,
    note: credit.reason,
    paidAt: new Date().toISOString(),
    dayCloseId: null,
    reference: null,
    edits: [],
    attachmentKeys: [],
  };
}

/**
 * Settle a credit (`settleCredit`, `S:1713`; REPLACE_WITH_API) and write its
 * ledger entry. Give back pays them out — a patient's as a refund, with a credit
 * note `CN-<seq>` when the credit names its invoice — and Got it back takes the
 * money in (from a party: "Money back"). Part of the amount leaves the rest
 * open ("₹X adjusted"; partial settlement is a backend request, Appendix F).
 * Use on next bill (Q-G9) adjusts min(credit, due) on the patient's oldest
 * invoice with a due as a Credit-mode receipt — nothing due is a 409.
 */
export async function settleCredit(
  id: string,
  settlement: CreditSettlement,
): Promise<CreditSettleResult> {
  const { clinicFixtures } = await fixtureWorld();
  const credit = await clinicFixtures.pendingCredits.get(id);
  assertOpen(credit);
  const remaining = credit.amount - credit.adjusted;
  const branchId =
    clinicFixtures.branches.snapshot((branch) => branch.isMain)[0]?.id ??
    clinicFixtures.branches.snapshot()[0]?.id ??
    '';
  await assertDayOpen(branchId, clinicToday());

  let payment: PaymentRecord;
  let creditNoteSeq: number | null = null;
  let invoiceSeq: number | null = null;
  if (settlement.action === 'use_on_bill') {
    const target = credit.patientId
      ? oldestDueInvoice(clinicFixtures, credit.patientId)
      : undefined;
    if (!target || credit.direction !== 'give') {
      throw clinicHttpError(409, 'conflict', NOTHING_DUE);
    }
    const amount = Math.min(remaining, target.due);
    payment = await clinicFixtures.payments.create(
      settlementPayment(
        credit,
        {
          direction: 'received',
          kind: 'receipt',
          patientId: credit.patientId,
          payeeName: null,
          expenseCategory: null,
          invoiceId: target.invoice.id,
          amount,
          splits: [{ mode: 'credit', amount }],
        },
        target.invoice.branchId,
        null,
      ),
    );
    invoiceSeq = target.invoice.seq;
  } else {
    const amount = settlement.splits.reduce((sum, split) => sum + split.amount, 0);
    if (amount <= 0 || settlement.splits.some((split) => split.amount <= 0)) {
      throw clinicHttpError(422, 'validation', ENTER_AMOUNT, { splits: [ENTER_AMOUNT] });
    }
    if (amount > remaining) {
      throw clinicHttpError(422, 'validation', MORE_THAN_OWED, {
        splits: [MORE_THAN_OWED],
      });
    }
    const entry = settlementEntry(
      credit,
      settlement.action,
      creditInvoiceId(credit, clinicFixtures),
    );
    let creditNoteId: string | null = null;
    if (entry.kind === 'refund' && entry.invoiceId) {
      const note = await clinicFixtures.creditNotes.create({
        invoiceId: entry.invoiceId,
        amount,
        reason: credit.reason,
      });
      creditNoteId = note.id;
      creditNoteSeq = note.seq;
    }
    payment = await clinicFixtures.payments.create(
      settlementPayment(
        credit,
        { ...entry, amount, splits: settlement.splits.map((split) => ({ ...split })) },
        branchId,
        creditNoteId,
      ),
    );
  }

  const adjusted = credit.adjusted + payment.amount;
  const settled = adjusted >= credit.amount;
  const statusOf = {
    give_back: 'given_back',
    got_back: 'got_back',
    use_on_bill: 'used',
  } as const;
  const updated = await clinicFixtures.pendingCredits.update(id, {
    adjusted,
    ...(settled
      ? {
          status: statusOf[settlement.action],
          settledAt: payment.paidAt,
          settledPaymentId: payment.id,
        }
      : {}),
  });
  return {
    credit: updated,
    paymentSeq: payment.seq,
    amount: payment.amount,
    invoiceSeq,
    creditNoteSeq,
  };
}
