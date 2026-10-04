import {
  clinicHttpError,
  compareText,
  validateClinicInput,
} from '@/shared/api/clinic/clinic-fixture-store.ts';
import { invoiceBalance, invoicePaid } from '@/shared/api/clinic/clinic-money.ts';
import {
  type DeleteReason,
  type Invoice,
  type OfferingSuggestion,
  type Patient,
  suggestionStatusSchema,
} from '@/shared/api/clinic/clinic-schema.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import {
  type PatientPlan,
  PLAN_QTY,
  type PlanActivity,
  type PlanIdea,
  type PlanIdeaReason,
  type PlanPurchase,
  type PlanSuggestion,
  type SuggestionCreateInput,
  type SuggestionPatch,
} from '@/shared/api/clinic/plan-contracts.ts';

import { findPersonThread } from './contact-threads.fixtures.ts';
import { FIXTURE_VIEWER_ID } from './staff.fixtures.ts';
import { clinicFixtures } from './world.fixtures.ts';

/**
 * The plan's fixture server (REPLACE_WITH_API: `getPlan`, `addSuggestion`,
 * `updateSuggestion`, `S:1635, 1646`): the suggestions joined with their
 * offering and who made them, the ideas derived from the patient's notes,
 * visits and packages (H:4355–4366), the last six purchase lines and the
 * contact's last five messages. `plan-api.ts` loads it on demand.
 */

const IDEA_LIMIT = 4;
const PURCHASE_LIMIT = 6;
const ACTIVITY_LIMIT = 5;

const fullName = (person: { firstName: string; lastName: string | null }) =>
  [person.firstName, person.lastName].filter(Boolean).join(' ');

function patientOf(patientId: string): Patient {
  const patient = clinicFixtures.patients.snapshot((row) => row.id === patientId)[0];
  if (!patient) throw clinicHttpError(404, 'not_found', 'Patient not found');
  return patient;
}

// ── Suggestions ──

/** What the suggestion's invoice links have invoiced: units and their amount. */
function invoicedOf(
  suggestion: OfferingSuggestion,
  invoices: ReadonlyMap<string, Invoice>,
): { qty: number; amount: number } {
  let qty = 0;
  let amount = 0;
  for (const link of suggestion.invoiceLinks) {
    const item = invoices.get(link.invoiceId)?.items[link.invoiceLineIndex];
    qty += link.qty;
    if (item && item.qty > 0) {
      amount += (item.rate * link.qty * (100 - item.discountPct)) / 100;
    }
  }
  return { qty, amount };
}

function suggestionOf(
  suggestion: OfferingSuggestion,
  offerings: ReadonlyMap<string, OfferingRecord>,
  invoices: ReadonlyMap<string, Invoice>,
): PlanSuggestion {
  const offering = offerings.get(suggestion.offeringId);
  const by = clinicFixtures.staff.snapshot(
    (row) => row.id === suggestion.suggestedById,
  )[0];
  const invoiced = invoicedOf(suggestion, invoices);
  return {
    id: suggestion.id,
    offeringId: suggestion.offeringId,
    name: offering?.name ?? null,
    category: offering?.category ?? null,
    tone: offering?.tone ?? 'stone',
    sessions: Math.max(1, offering?.sessions ?? 1),
    listPrice: offering?.price ?? 0,
    floorPrice: offering && offering.minPrice > 0 ? offering.minPrice : null,
    qty: suggestion.qty,
    price: suggestion.price,
    status: suggestion.status,
    appointmentId: suggestion.appointmentId,
    sourceLabel: suggestion.sourceLabel,
    reason: suggestion.reason,
    createdAt: suggestion.createdAt,
    invoicedQty: invoiced.qty,
    invoicedAmount: invoiced.amount,
    suggestedBy: by ? { name: fullName(by), initials: by.initials, tone: by.tone } : null,
  };
}

// ── Ideas (H:4355–4366) ──

/** A doctor's note's keyword and the offerings it points at. */
const NOTE_IDEAS: readonly [RegExp, RegExp][] = [
  [/lhr|laser hair/, /lhr/i],
  [/peel/, /peel/i],
  [/hydra/, /hydra|facial/i],
  [/prp/, /prp|hair/i],
];

/** A complaint's keyword, the offerings it points at and the complaint's name. */
const COMPLAINT_IDEAS: readonly [RegExp, RegExp, string][] = [
  [/tan|pigment|melasma|pih|uneven/, /d-tan|peel/i, 'pigmentation'],
  [/hair fall|alopecia/, /prp|hair/i, 'hair fall'],
  [/acne|pimple/, /peel|acne/i, 'acne'],
];

/** A clinical note's lines — the plan keeps them as one text until notes become arrays (Appendix F). */
const linesOf = (text: string | null) =>
  (text ?? '')
    .split(/[\n;·]+/)
    .map((line) => line.trim())
    .filter(Boolean);

/** The kind of treatment a visit was, for its package idea. */
function packageKeyword(service: string): RegExp | null {
  if (/lhr|laser/i.test(service)) return /lhr/i;
  if (/peel/i.test(service)) return /peel/i;
  if (/facial|hydra/i.test(service)) return /facial|hydra/i;
  return null;
}

/** The patient's visits and treatments so far, and the last thing they had. */
function visitHistory(patient: Patient): { count: number; lastService: string } {
  const visits = clinicFixtures.appointments.snapshot(
    (visit) =>
      visit.patientId === patient.id &&
      (visit.status === 'completed' || visit.status === 'checked_in'),
  );
  const treatments = clinicFixtures.treatments
    .snapshot((row) => row.patientId === patient.id)
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt));
  const lastVisit = [...visits].sort((a, b) => compareText(b.date, a.date))[0];
  return {
    count: visits.length + treatments.length,
    lastService: treatments[0]?.name ?? lastVisit?.serviceLabel ?? '',
  };
}

function ideasFor(
  patient: Patient,
  suggestions: readonly OfferingSuggestion[],
  offerings: readonly OfferingRecord[],
): PlanIdea[] {
  const live = offerings.filter((offering) => offering.active);
  const suggested = (offeringId: string) =>
    suggestions.some((row) => row.offeringId === offeringId && row.status !== 'declined');
  const find = (pattern: RegExp) =>
    live.find((offering) => pattern.test(offering.name) && !suggested(offering.id));
  const ideas: PlanIdea[] = [];
  const push = (offering: OfferingRecord | undefined, reason: PlanIdeaReason) => {
    if (!offering || ideas.some((idea) => idea.offeringId === offering.id)) return;
    ideas.push({
      offeringId: offering.id,
      name: offering.name,
      category: offering.category,
      tone: offering.tone,
      sessions: Math.max(1, offering.sessions),
      listPrice: offering.price,
      reason,
    });
  };

  for (const note of linesOf(patient.treatmentSuggestions)) {
    const match = NOTE_IDEAS.find(([keyword]) => keyword.test(note.toLowerCase()));
    if (match) push(find(match[1]), { kind: 'note', text: note });
  }
  const words = [patient.complaints, patient.diagnosis, patient.treatmentSuggestions]
    .join(' ')
    .toLowerCase();
  const firstComplaint = linesOf(patient.complaints)[0];
  for (const [keyword, pattern, name] of COMPLAINT_IDEAS) {
    if (keyword.test(words)) {
      push(find(pattern), { kind: 'complaint', text: firstComplaint ?? name });
    }
  }

  const history = visitHistory(patient);
  if (history.count >= 2) {
    const keyword = packageKeyword(history.lastService);
    const pack = keyword
      ? live.find(
          (offering) =>
            keyword.test(offering.name) &&
            offering.sessions > 1 &&
            !suggested(offering.id),
        )
      : undefined;
    push(pack, { kind: 'visits', count: history.count });
  }
  const count = history.count;
  const byId = new Map(offerings.map((offering) => [offering.id, offering]));
  for (const pack of clinicFixtures.patientPackages.snapshot(
    (row) => row.patientId === patient.id && row.sessionsTotal - row.sessionsUsed <= 1,
  )) {
    const offering = byId.get(pack.offeringId);
    if (offering?.active) push(offering, { kind: 'renew' });
  }
  if (count === 0 && ideas.length === 0) push(find(/consult/i), { kind: 'first' });
  return ideas.slice(0, IDEA_LIMIT);
}

// ── Purchases and activity ──

function purchasesOf(
  invoices: readonly Invoice[],
  offerings: readonly OfferingRecord[],
  patientId: string,
): PlanPurchase[] {
  const payments = clinicFixtures.payments.snapshot();
  const packages = clinicFixtures.patientPackages.snapshot(
    (row) => row.patientId === patientId,
  );
  const byId = new Map(offerings.map((offering) => [offering.id, offering]));
  const byName = new Map(offerings.map((offering) => [offering.name, offering]));
  return [...invoices]
    .sort((a, b) => compareText(b.date, a.date) || b.seq - a.seq)
    .flatMap((invoice) => {
      const status = invoiceBalance(invoice, payments).status;
      return invoice.items.map((item, index): PlanPurchase => {
        const offering =
          (item.offeringId ? byId.get(item.offeringId) : undefined) ??
          byName.get(item.name);
        const pack =
          offering && offering.sessions > 1
            ? packages.find(
                (row) => row.offeringId === offering.id && row.invoiceId === invoice.id,
              )
            : undefined;
        return {
          id: `${invoice.id}:${index}`,
          invoiceId: invoice.id,
          invoiceSeq: invoice.seq,
          invoiceType: invoice.type,
          invoiceStatus: status,
          date: invoice.date,
          name: item.name,
          category: offering?.category ?? null,
          qty: item.qty,
          amount: (item.rate * item.qty * (100 - item.discountPct)) / 100,
          sessions: pack ? { used: pack.sessionsUsed, total: pack.sessionsTotal } : null,
        };
      });
    })
    .slice(0, PURCHASE_LIMIT);
}

function threadOf(patient: Patient) {
  return findPersonThread(clinicFixtures.leads.snapshot(), {
    leadId: patient.leadId,
    patientId: patient.id,
    phone: patient.phone,
  });
}

function activityOf(leadId: string): PlanActivity[] {
  return clinicFixtures.leadMessages
    .snapshot((message) => message.leadId === leadId && !message.isSystem)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
    .slice(0, ACTIVITY_LIMIT)
    .map((message) => ({
      id: message.id,
      at: message.sentAt,
      channel: message.channel,
      direction: message.direction === 'sent' ? 'sent' : 'got',
      text: message.body,
      delivery: message.direction === 'sent' ? message.deliveryStatus : null,
    }));
}

// ── Reads ──

/**
 * A patient's plan (`getPlan`, `S:1635`): their suggestions (oldest first, as
 * they were made), up to four ideas, the last six purchase lines with what
 * they paid in all, and the last five messages of their thread.
 */
export async function getPlan(patientId: string): Promise<PatientPlan> {
  const patient = patientOf(patientId);
  const offerings = clinicFixtures.offerings.snapshot();
  const offeringsById = new Map(offerings.map((offering) => [offering.id, offering]));
  const invoices = clinicFixtures.invoices.snapshot((row) => row.patientId === patientId);
  const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const suggestions = clinicFixtures.offeringSuggestions
    .snapshot((row) => row.patientId === patientId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const payments = clinicFixtures.payments.snapshot();
  const thread = threadOf(patient);
  return {
    suggestions: suggestions.map((row) => suggestionOf(row, offeringsById, invoicesById)),
    ideas: ideasFor(patient, suggestions, offerings),
    purchases: purchasesOf(invoices, offerings, patientId),
    paidSoFar: invoices.reduce(
      (sum, invoice) => sum + invoicePaid(invoice.id, payments),
      0,
    ),
    lead: thread ? { id: thread.id, seq: thread.seq, status: thread.status } : null,
    activity: thread ? activityOf(thread.id) : [],
  };
}

// ── Writes ──

function suggestionRecord(id: string): OfferingSuggestion {
  const row = clinicFixtures.offeringSuggestions.snapshot(
    (record) => record.id === id,
  )[0];
  if (!row) throw clinicHttpError(404, 'not_found', 'Offering suggestion not found');
  return row;
}

function refuse(field: string, message: string): never {
  throw clinicHttpError(422, 'validation', message, { [field]: [message] });
}

/**
 * Add a suggestion (`addSuggestion`, `S:1646`): one unit at list price,
 * Planned — 409 when the offering is already suggested and not declined.
 */
export async function addSuggestion(
  input: SuggestionCreateInput,
): Promise<OfferingSuggestion> {
  patientOf(input.patientId);
  const offering = clinicFixtures.offerings.snapshot(
    (row) => row.id === input.offeringId && row.active,
  )[0];
  if (!offering) refuse('offeringId', 'Pick an offering the clinic has');
  const already = clinicFixtures.offeringSuggestions.snapshot(
    (row) =>
      row.patientId === input.patientId &&
      row.offeringId === input.offeringId &&
      row.status !== 'declined',
  );
  if (already.length > 0) {
    const message = `${offering.name} is already in suggestions`;
    throw clinicHttpError(409, 'duplicate', message, { offeringId: [message] });
  }
  return clinicFixtures.offeringSuggestions.create({
    patientId: input.patientId,
    offeringId: input.offeringId,
    qty: 1,
    price: null,
    status: 'planned',
    sourceLabel: input.sourceLabel,
    appointmentId: input.appointmentId ?? null,
    reason: input.reason?.trim() || null,
    suggestedById: FIXTURE_VIEWER_ID,
    invoiceLinks: [],
  });
}

/**
 * Edit a suggestion (`updateSuggestion`, `S:1646`): a quantity of 1–99, a
 * final price in whole paise (a price under the floor warns in the card,
 * never blocks) or a status.
 */
export async function updateSuggestion(
  id: string,
  patch: SuggestionPatch,
): Promise<OfferingSuggestion> {
  suggestionRecord(id);
  const next: Partial<OfferingSuggestion> = {};
  if (patch.qty !== undefined) {
    if (
      !Number.isInteger(patch.qty) ||
      patch.qty < PLAN_QTY.min ||
      patch.qty > PLAN_QTY.max
    ) {
      refuse('qty', `Pick a quantity from ${PLAN_QTY.min} to ${PLAN_QTY.max}`);
    }
    next.qty = patch.qty;
  }
  if (patch.price !== undefined) {
    if (patch.price !== null && (!Number.isInteger(patch.price) || patch.price < 0)) {
      refuse('price', 'Enter a price of zero or more');
    }
    next.price = patch.price;
  }
  if (patch.status !== undefined) {
    next.status = validateClinicInput(suggestionStatusSchema, patch.status);
  }
  return clinicFixtures.offeringSuggestions.update(id, next);
}

/** Remove a suggestion with the reason confirm's choice (soft — the Undo restores it). */
export async function removeSuggestion(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<OfferingSuggestion> {
  suggestionRecord(id);
  return clinicFixtures.offeringSuggestions.remove(id, reason, note);
}

/** Bring a removed suggestion back — its "removed" toast's Undo. */
export async function restoreSuggestion(id: string): Promise<OfferingSuggestion> {
  return clinicFixtures.offeringSuggestions.restore(id);
}
