import { FIXTURE_ACTOR_ID } from './clinic-fixture-store.ts';
import { invoiceBalance } from './clinic-money.ts';
import { patientName } from './patients-contracts.ts';
import type { LedgerPerson, LedgerRow, PaymentRecord } from './payments-contracts.ts';

/*
 * The ledger's joins — the fixture server's, REPLACE_WITH_API (clinozy-be
 * embeds them in `listLedger`, `S:1699`): what a row names beside its entry —
 * the party, the invoice and its due, the credit note, the supplier bill, the
 * pending credit, who recorded it, and its lock. The ledger's reads and Day
 * close's review word an entry from the same row.
 */

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');
const fixtureStaff = () => import('./fixtures/staff.fixtures.ts');

/** What every ledger read needs beside the entries. */
export interface LedgerContext {
  patients: ReadonlyMap<string, { name: string; seq: number }>;
  invoices: ReadonlyMap<string, LedgerRow['invoice']>;
  creditNotes: ReadonlyMap<string, number>;
  purchases: ReadonlyMap<string, number>;
  credits: ReadonlyMap<string, number>;
  staff: ReadonlyMap<string, LedgerPerson>;
  viewerId: string;
}

/** The joins every ledger read needs: patients, invoices and their dues, credit notes, purchases, credits, staff. */
export async function ledgerContext(): Promise<LedgerContext> {
  const { clinicFixtures: world } = await fixtureWorld();
  const { FIXTURE_VIEWER_ID } = await fixtureStaff();
  const payments = world.payments.snapshot();
  const bySeq = <T extends { id: string; seq: number }>(rows: readonly T[]) =>
    new Map(rows.map((row) => [row.id, row.seq]));
  return {
    patients: new Map(
      world.patients
        .snapshot()
        .map((patient) => [patient.id, { name: patientName(patient), seq: patient.seq }]),
    ),
    invoices: new Map(
      world.invoices.snapshot().map((invoice) => [
        invoice.id,
        {
          seq: invoice.seq,
          type: invoice.type,
          due: invoiceBalance(invoice, payments).due,
        },
      ]),
    ),
    creditNotes: bySeq(world.creditNotes.snapshot()),
    purchases: new Map([
      ...bySeq(world.purchaseOrders.snapshot()),
      ...bySeq(world.stockPurchases.snapshot()),
    ]),
    credits: bySeq(world.pendingCredits.snapshot()),
    staff: new Map(
      world.staff.snapshot().map((member) => [
        member.id,
        {
          id: member.id,
          name: [member.firstName, member.lastName].filter(Boolean).join(' '),
          initials: member.initials,
          tone: member.tone,
        },
      ]),
    ),
    viewerId: FIXTURE_VIEWER_ID,
  };
}

/** The member behind an entry: the fixture actor is the signed-in viewer. */
function byOf(payment: PaymentRecord, context: LedgerContext): LedgerPerson | null {
  const id =
    payment.createdById === FIXTURE_ACTOR_ID ? context.viewerId : payment.createdById;
  return context.staff.get(id) ?? null;
}

/** The value `id` names in `map`, null when there is no id or no such entry. */
function lookup<T>(map: ReadonlyMap<string, T>, id: string | null): T | null {
  return id === null ? null : (map.get(id) ?? null);
}

/** The supplier bill an entry paid: its kind, the purchase's number and the bill number. */
function billOf(payment: PaymentRecord, context: LedgerContext): LedgerRow['bill'] {
  const { billRef } = payment;
  if (!billRef || billRef.kind === 'other') return null;
  return {
    kind: billRef.kind,
    seq: context.purchases.get(billRef.purchaseId) ?? 0,
    billNo: billRef.billNo,
  };
}

/** An entry as a ledger row: what its cells name, and its lock (`dayCloseId`, `S:662`). */
export function toLedgerRow(payment: PaymentRecord, context: LedgerContext): LedgerRow {
  const patient = lookup(context.patients, payment.patientId);
  return {
    ...payment,
    partyName: patient?.name ?? payment.payeeName ?? '—',
    patientSeq: patient?.seq ?? null,
    invoice: lookup(context.invoices, payment.invoiceId),
    creditNoteSeq: lookup(context.creditNotes, payment.creditNoteId),
    bill: billOf(payment, context),
    pendingCreditSeq: lookup(context.credits, payment.pendingCreditId),
    by: byOf(payment, context),
    locked: payment.dayCloseId !== null,
  };
}
