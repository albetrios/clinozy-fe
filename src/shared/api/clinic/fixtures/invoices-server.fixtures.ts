import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import {
  clinicHttpError,
  compareText,
  type CreateInput,
  type CursorPage,
  refuseUnknownIds,
  validateClinicInput,
} from '@/shared/api/clinic/clinic-fixture-store.ts';
import {
  balanceOf,
  belowFloor,
  invoicePaid,
  invoiceTotals,
  lineFloor,
} from '@/shared/api/clinic/clinic-money.ts';
import type {
  DeleteReason,
  MedicalContact,
  MedicalSale,
  OfferingSuggestion,
  PatientPackage,
  PaymentSplit,
  Prescription,
} from '@/shared/api/clinic/clinic-schema.ts';
import { addCivilDays, clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { assertDayOpen } from '@/shared/api/clinic/day-close-api.ts';
import {
  INVOICE_CUSTOMER_MESSAGE,
  type InvoiceDetail,
  type InvoiceInput,
  invoiceInputSchema,
  type InvoiceParty,
  type InvoicePresets,
  type InvoiceRecord,
  type InvoiceRepeatSource,
  type InvoiceRxPreset,
  type InvoiceSaveResult,
  medicalContactInputSchema,
  type OftenBilledKind,
  type SaleContact,
  type SaleCustomerRow,
} from '@/shared/api/clinic/invoices-contracts.ts';
import {
  fefoTakes,
  medicineStock,
  withTakes,
} from '@/shared/api/clinic/medicine-stock.ts';
import { effectivePrice } from '@/shared/api/clinic/offerings-pricing.ts';
import { isLeadNotPatient } from '@/shared/api/clinic/patient-search-api.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import { newLedgerEntry } from '@/shared/api/clinic/payments-api.ts';
import type { TaskRecord } from '@/shared/api/clinic/tasks-contracts.ts';

import { clinicFixtures as world, clinicOrganization } from './world.fixtures.ts';

/**
 * The invoices' fixture server (REPLACE_WITH_API: `getInvoice`,
 * `createInvoice` / `updateInvoice`, `S:1704, 1716`; `createSale`, `S:1666`):
 * the reads the shared Invoice drawer and the preview need, and the writes with
 * everything the server does on a save — the totals, the receipt for "Paid
 * now", a package per unit of a multi-session offering, the plan rows the lines
 * invoice, a "Payment due" task for a balance (the fixture rule, Q-T3) and, for
 * a Medical sale, the sale itself with its stock drawn by earliest expiry.
 * `invoices-api.ts` loads it on demand.
 */

/** "No expiry" on a package: the longest validity an offering may carry (`S:569`). */
const NO_EXPIRY_DAYS = 1095;
/** The customer field's page (`S:1540`). */
const CUSTOMER_PAGE = 30;

// ── Words the server writes (data, English like the contract's messages) ──

/** Whole rupees in the Indian grouping — "₹1,23,456" — for the server's own texts. */
function rupeeText(paise: number): string {
  const digits = String(Math.round(Math.abs(paise) / 100));
  let grouped = digits.slice(-3);
  for (let end = digits.length - 3; end > 0; end -= 2) {
    grouped = `${digits.slice(Math.max(0, end - 2), end)},${grouped}`;
  }
  return `₹${grouped}`;
}

const TYPE_WORDS: Readonly<Record<InvoiceRecord['type'], string>> = {
  clinic: 'Clinic',
  medical: 'Medical',
  consultation: 'Consultation',
};

/** "Paid ₹X is more than the bill ₹Y" (`payments.md:146`). */
const paidAboveBill = (paid: number, bill: number) =>
  `Paid ${rupeeText(paid)} is more than the bill ${rupeeText(bill)}`;

// ── Reads ──

const sumOf = (splits: readonly Pick<PaymentSplit, 'amount'>[]) =>
  splits.reduce((sum, split) => sum + split.amount, 0);

/** Who an invoice bills: its patient, else its Medical contact. */
function partyOf(
  invoice: Pick<InvoiceRecord, 'patientId' | 'medicalContactId'>,
): InvoiceParty | null {
  if (invoice.patientId) {
    const patient = world.patients.snapshot((row) => row.id === invoice.patientId)[0];
    if (patient) {
      return {
        kind: 'patient',
        id: patient.id,
        seq: patient.seq,
        name: patientName(patient),
        firstName: patient.firstName,
        lastName: patient.lastName,
        phone: patient.phone,
      };
    }
  }
  if (invoice.medicalContactId) {
    const contact = world.medicalContacts.snapshot(
      (row) => row.id === invoice.medicalContactId,
    )[0];
    if (contact)
      return {
        kind: 'contact',
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
      };
  }
  return null;
}

/** The invoice and what the drawer, the preview and the print read with it. */
function detailOf(invoice: InvoiceRecord): InvoiceDetail {
  const payments = world.payments.snapshot((row) => row.invoiceId === invoice.id);
  const sale = invoice.saleId
    ? (world.medicalSales.snapshot((row) => row.id === invoice.saleId)[0] ?? null)
    : null;
  const branches = world.branches.snapshot();
  const branch =
    branches.find((row) => row.id === invoice.branchId) ??
    branches.find((row) => row.isMain) ??
    branches[0];
  const organization = clinicOrganization();
  return {
    invoice,
    party: partyOf(invoice),
    sale: sale ? { id: sale.id, seq: sale.seq } : null,
    payments,
    balance: balanceOf(invoiceTotals(invoice).bill, invoicePaid(invoice.id, payments)),
    sheet: {
      organization: {
        name: organization.name,
        specialties: organization.specialties,
        currency: organization.currency,
      },
      branch: { phone: branch?.phone ?? '', gstNumber: branch?.gstNumber ?? null },
    },
  };
}

/** One invoice (`getInvoice`, `S:1704`) — a 404 when it is unknown or deleted. */
export async function getInvoice(id: string): Promise<InvoiceDetail> {
  return detailOf(await world.invoices.get(id));
}

/**
 * What Quick fill reads for a patient (H:5066): the packages they hold, their
 * last invoice of each type, their latest prescription and the team their
 * last invoice named.
 */
export async function getInvoicePresets(patientId: string): Promise<InvoicePresets> {
  const invoices = world.invoices
    .snapshot((row) => row.patientId === patientId)
    .sort((a, b) => compareText(b.date, a.date) || b.seq - a.seq);
  const lastByType: InvoicePresets['lastByType'] = {};
  for (const invoice of invoices) {
    lastByType[invoice.type] ??= repeatSourceOf(invoice);
  }
  const rx = world.prescriptions
    .snapshot((row) => row.patientId === patientId)
    .sort((a, b) => compareText(b.date, a.date) || b.seq - a.seq)[0];
  return {
    // Every package they hold, used up or not: Quick fill offers another one (H:5066).
    packages: world.patientPackages
      .snapshot((row) => row.patientId === patientId)
      .map((row) => ({ offeringId: row.offeringId })),
    lastByType,
    latestRx: rx ? rxPresetOf(rx) : null,
    recentTeamIds: invoices.find((row) => row.teamIds.length > 0)?.teamIds ?? [],
  };
}

/** A prescription as a sale reads it: its patient and its medicines with their quantities. */
function rxPresetOf(rx: Prescription): InvoiceRxPreset {
  const medicines = world.medicines.snapshot();
  return {
    id: rx.id,
    seq: rx.seq,
    patientId: rx.patientId,
    medicines: rx.items.map((item) => {
      const medicine = medicines.find((row) => row.id === item.medicineId);
      return {
        medicineId: medicine?.id ?? null,
        name: medicine?.name ?? '',
        qty: Math.max(1, item.qty),
      };
    }),
  };
}

/**
 * A prescription to sell from (`?prescription=`, `S:50`; the Rx "Sell
 * medicines" / "Save & sell"): its patient and medicines — a 404 when it is
 * unknown or deleted.
 */
export async function getPrescriptionPreset(id: string): Promise<InvoiceRxPreset> {
  return rxPresetOf(await world.prescriptions.get(id));
}

function repeatSourceOf(invoice: InvoiceRecord): InvoiceRepeatSource {
  return {
    id: invoice.id,
    seq: invoice.seq,
    type: invoice.type,
    items: invoice.items,
    teamIds: invoice.teamIds,
  };
}

/** A line's name before its " · " detail: "LHR Full Face · B4G7" counts as "LHR Full Face". */
const baseName = (name: string) => name.split(' · ')[0] ?? name;

/**
 * "Often billed" (H:5058): the names on the most live invoices — Medical
 * invoices' for the medicine line, the others' for the offerings line — most
 * first. The drawer keeps the first five its catalogue lists.
 */
export async function getOftenBilled(kind: OftenBilledKind): Promise<string[]> {
  const counts = new Map<string, number>();
  for (const invoice of world.invoices.snapshot()) {
    if ((invoice.type === 'medical') !== (kind === 'medical')) continue;
    for (const item of invoice.items) {
      const name = baseName(item.name);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]))
    .map(([name]) => name);
}

/** Whether a person matches the customer field's text: name, mobile digits or number. */
function matchesCustomer(
  person: { name: string; phone: string | null; seq?: number },
  text: string,
): boolean {
  if (!text) return true;
  const digits = text.replace(/\D/g, '');
  return (
    person.name.toLowerCase().includes(text) ||
    (digits.length >= 3 && (person.phone ?? '').includes(digits)) ||
    (person.seq !== undefined && `#${person.seq}`.includes(text.replace(/\s/g, '')))
  );
}

/**
 * The Medical customer field's list (`payments.md:138`): patients, the leads
 * that are not patients yet and the Medical contacts matching the text, A–Z
 * within each group, in pages of thirty.
 */
export async function searchSaleCustomers(
  query: string,
  cursor: string | null = null,
): Promise<CursorPage<SaleCustomerRow>> {
  const text = query.trim().toLowerCase();
  const byName = (a: { name: string }, b: { name: string }) =>
    compareText(a.name, b.name);
  const patients: SaleCustomerRow[] = world.patients
    .snapshot()
    .map((row) => ({
      kind: 'patient' as const,
      id: row.id,
      seq: row.seq,
      name: patientName(row),
      phone: row.phone,
    }))
    .filter((row) => matchesCustomer(row, text))
    .sort(byName);
  const leads: SaleCustomerRow[] = world.leads
    .snapshot(isLeadNotPatient)
    .map((row) => ({
      kind: 'lead' as const,
      id: row.id,
      seq: row.seq,
      name: row.name,
      phone: row.phone,
    }))
    .filter((row) => matchesCustomer(row, text))
    .sort(byName);
  const contacts: SaleCustomerRow[] = world.medicalContacts
    .snapshot()
    .map((row) => ({
      kind: 'contact' as const,
      id: row.id,
      name: row.name,
      phone: row.phone,
    }))
    .filter((row) => matchesCustomer(row, text))
    .sort(byName);
  const rows = [...patients, ...leads, ...contacts];
  const start = cursor ? Number(cursor) : 0;
  const end = start + CUSTOMER_PAGE;
  return {
    items: rows.slice(start, end),
    nextCursor: end < rows.length ? String(end) : null,
  };
}

// ── Medical contacts ──

/** "Add contact “q”" (`payments.md:138`): a Medical contact with the typed name. */
export async function addMedicalContact(raw: { name: string }): Promise<SaleContact> {
  const { name } = validateClinicInput(medicalContactInputSchema, raw);
  const contact = await world.medicalContacts.create({ name, phone: null });
  return { id: contact.id, name: contact.name, phone: contact.phone };
}

/** The Mobile field under a new contact — "saved on the contact" (`payments.md:138`). */
export async function setMedicalContactPhone(
  id: string,
  phone: string | null,
): Promise<SaleContact> {
  if (phone !== null && !/^\+91[6-9]\d{9}$/.test(phone)) {
    throw clinicHttpError(422, 'validation', 'Enter a 10-digit mobile', {
      phone: ['Enter a 10-digit mobile'],
    });
  }
  const contact = await world.medicalContacts.update(id, { phone });
  return { id: contact.id, name: contact.name, phone: contact.phone };
}

/** A lead bought as a Medical customer becomes a contact — the same mobile's, when one exists (C24). */
async function contactForLead(leadId: string): Promise<MedicalContact> {
  const lead = await world.leads.get(leadId);
  const same = lead.phone
    ? world.medicalContacts.snapshot((row) => row.phone === lead.phone)[0]
    : undefined;
  return same ?? world.medicalContacts.create({ name: lead.name, phone: lead.phone });
}

// ── The checks a save runs ──

/** A 422 on the field the message names. */
function refuse(field: string, message: string): never {
  throw clinicHttpError(422, 'validation', message, { [field]: [message] });
}

/**
 * The lowest price (`minPrice`) holds for everyone (H:5059): a line below it
 * is refused. Which discounts a role may give above it is the drawer's check
 * (the `disc` ability, Q-U8) — the fixture knows no viewer.
 */
function refuseBelowLowestPrice(input: InvoiceInput): void {
  const offerings = world.offerings.snapshot();
  input.items.forEach((line, index) => {
    const offering = offerings.find((row) => row.id === line.offeringId);
    if (!offering) return;
    const floor = lineFloor(line, offering.minPrice, offering.gstInclusive);
    if (belowFloor(line, floor)) {
      refuse(
        `items.${index}.discountPct`,
        `${line.name} has more discount than allowed · raise the final price or ask an admin`,
      );
    }
  });
}

/** What the save writes beside the record, checked before anything is written. */
function checkInput(
  input: InvoiceInput,
  alreadyPaid: number,
): { bill: number; paidNow: number } {
  if (input.patientId) {
    refuseUnknownIds(
      'patientId',
      [input.patientId],
      world.patients.snapshot(),
      'Pick a patient',
    );
  }
  refuseUnknownIds(
    'teamIds',
    input.teamIds,
    world.staff.snapshot(),
    'Pick the team again',
  );
  const offeringIds = input.items.flatMap((line) =>
    line.offeringId ? [line.offeringId] : [],
  );
  refuseUnknownIds(
    'items',
    offeringIds,
    world.offerings.snapshot(),
    'Pick the offering again',
  );
  const totals = invoiceTotals(input);
  if (input.overallDiscount > totals.subtotal) {
    refuse('overallDiscount', 'The discount is more than the bill');
  }
  refuseBelowLowestPrice(input);
  const paidNow = sumOf(input.paidNow);
  if (alreadyPaid + paidNow > totals.bill) {
    throw clinicHttpError(
      409,
      'conflict',
      paidAboveBill(alreadyPaid + paidNow, totals.bill),
    );
  }
  return { bill: totals.bill, paidNow };
}

// ── What a save writes besides the invoice ──

/** The receipt "Paid now" records against the invoice — one entry, a split per mode. */
async function writeReceipt(
  invoice: InvoiceRecord,
  splits: InvoiceInput['paidNow'],
): Promise<void> {
  if (splits.length === 0) return;
  const contact = partyOf(invoice);
  await world.payments.create(
    newLedgerEntry({
      direction: 'received',
      kind: 'receipt',
      branchId: invoice.branchId,
      amount: sumOf(splits),
      splits: splits.map((split) => ({ mode: split.mode, amount: split.amount })),
      patientId: invoice.patientId,
      invoiceId: invoice.id,
      // A walk-in buyer has no patient: the ledger names them as the payer.
      payeeName: invoice.patientId ? null : (contact?.name ?? null),
    }),
  );
}

/**
 * A package per unit of each multi-session offering on the invoice
 * (H:5065): its sessions plus a live extra-sessions offer's, valid for the
 * offering's validity from the invoice's date. An edit keeps the packages
 * already in use and adds or drops unused ones to match the quantities.
 */
async function syncPackages(invoice: InvoiceRecord): Promise<void> {
  if (!invoice.patientId) return;
  const patientId = invoice.patientId;
  const wanted = new Map<string, number>();
  for (const line of invoice.items) {
    const offering = world.offerings.snapshot((row) => row.id === line.offeringId)[0];
    if (!offering || offering.sessions <= 1) continue;
    wanted.set(offering.id, (wanted.get(offering.id) ?? 0) + line.qty);
  }
  const held = world.patientPackages.snapshot((row) => row.invoiceId === invoice.id);
  for (const pack of held) {
    const left = wanted.get(pack.offeringId) ?? 0;
    if (left > 0) wanted.set(pack.offeringId, left - 1);
    else if (pack.sessionsUsed === 0)
      await world.patientPackages.remove(pack.id, 'not_needed', null);
  }
  const offers = world.offers.snapshot();
  for (const [offeringId, count] of wanted) {
    const offering = await world.offerings.get(offeringId);
    const extra = effectivePrice(offering, invoice.branchId, offers).extraSessions;
    for (let unit = 0; unit < count; unit += 1) {
      const pack: CreateInput<PatientPackage> = {
        patientId,
        offeringId,
        invoiceId: invoice.id,
        sessionsTotal: Math.min(99, offering.sessions + extra),
        sessionsUsed: 0,
        validUntil: addCivilDays(invoice.date, offering.validityDays || NO_EXPIRY_DAYS),
      };
      await world.patientPackages.create(pack);
    }
  }
}

/** One invoice line's units still free to link to a plan row. */
interface LinePool {
  offeringId: string | null;
  index: number;
  left: number;
}

/**
 * A suggestion's links once the invoice's free units are given to it: up to
 * what it still needs, from the lines of its offering — `added` when any were.
 */
function takeUnits(
  suggestion: OfferingSuggestion,
  links: OfferingSuggestion['invoiceLinks'],
  pool: LinePool[],
  invoiceId: string,
): { links: OfferingSuggestion['invoiceLinks']; added: boolean } {
  let need = Math.max(0, suggestion.qty - links.reduce((sum, link) => sum + link.qty, 0));
  const next = [...links];
  for (const line of pool) {
    if (need === 0) break;
    if (line.left === 0 || line.offeringId !== suggestion.offeringId) continue;
    const take = Math.min(need, line.left);
    line.left -= take;
    need -= take;
    next.push({ invoiceId, invoiceLineIndex: line.index, qty: take });
  }
  return { links: next, added: next.length > links.length };
}

/**
 * The patient's plan rows the invoice's lines invoice (H:4410 `planLink`):
 * this invoice's earlier links come off, then each line's units go to the
 * patient's suggestions of that offering still short of their quantity —
 * those turn Accepted. Declined and removed suggestions take none.
 * Returns how many suggestions the invoice now links.
 */
async function linkPlan(invoice: InvoiceRecord): Promise<number> {
  if (!invoice.patientId || invoice.type === 'medical') return 0;
  const pool: LinePool[] = invoice.items.map((line, index) => ({
    offeringId: line.offeringId,
    index,
    left: line.qty,
  }));
  let linked = 0;
  const suggestions = world.offeringSuggestions
    .snapshot((row) => row.patientId === invoice.patientId)
    .sort((a, b) => compareText(a.createdAt, b.createdAt));
  for (const suggestion of suggestions) {
    const kept = suggestion.invoiceLinks.filter((link) => link.invoiceId !== invoice.id);
    const { links, added } =
      suggestion.status === 'declined'
        ? { links: kept, added: false }
        : takeUnits(suggestion, kept, pool, invoice.id);
    if (links.length === suggestion.invoiceLinks.length && !added) continue;
    if (added) linked += 1;
    await world.offeringSuggestions.update(suggestion.id, {
      invoiceLinks: links,
      ...(added ? { status: 'accepted' as const } : {}),
    });
  }
  return linked;
}

/**
 * A balance opens a "Payment due" task (the fixture rule, Q-T3; H:5065) —
 * one per invoice: "Collect ₹1,200 from Rhea", for the front desk, due today.
 */
async function openPaymentDueTask(invoice: InvoiceRecord, due: number): Promise<void> {
  if (due <= 0) return;
  const open = world.tasks.snapshot(
    (row) =>
      row.sourceId === invoice.id && row.rule === 'payment' && row.status === 'open',
  );
  if (open.length > 0) return;
  const party = partyOf(invoice);
  const first =
    party?.kind === 'patient' ? party.firstName : (party?.name.split(' ')[0] ?? '');
  const task: CreateInput<TaskRecord> = {
    kind: 'payment_reminder',
    title: `Collect ${rupeeText(due)} from ${first}`.trim(),
    why: `${TYPE_WORDS[invoice.type]} invoice ${displayId.invoiceNumber(invoice.seq)} has a balance.`,
    ownerId: null,
    ownerRole: 'front_desk',
    patientId: invoice.patientId,
    leadId: null,
    sourceType: 'invoice',
    sourceId: invoice.id,
    dueAt: new Date().toISOString(),
    status: 'open',
    snoozedUntil: null,
    outcome: null,
    resolvedAt: null,
    rule: 'payment',
    ruleKey: null,
    ruleOutcome: null,
    result: null,
    note: null,
    resolvedBy: null,
    resolvedById: null,
    snoozeLabel: null,
    previousOwnerIds: [],
    manualType: null,
    priority: 'normal',
    remindMinutesBefore: null,
  };
  await world.tasks.create(task);
}

/** The record's fields from a write. */
function recordFields(input: InvoiceInput) {
  return {
    type: input.type,
    branchId: input.branchId,
    patientId: input.patientId,
    medicalContactId: input.patientId ? null : input.medicalContactId,
    teamIds: input.teamIds,
    items: input.items.map((line) => ({ ...line, batchNo: null })),
    overallDiscount: input.overallDiscount,
    date: input.date,
    remark: input.remark || null,
    prescriptionId: input.prescriptionId,
  };
}

/** Everything a save writes after the invoice itself. */
async function afterSave(
  invoice: InvoiceRecord,
  paidNow: InvoiceInput['paidNow'],
): Promise<InvoiceSaveResult> {
  await writeReceipt(invoice, paidNow);
  await syncPackages(invoice);
  const planLinked = await linkPlan(invoice);
  const detail = detailOf(invoice);
  await openPaymentDueTask(invoice, detail.balance.due);
  return { detail, planLinked };
}

// ── Writes ──

/**
 * Create a clinic or consultation invoice (`createInvoice`, `S:1716`) — a
 * Medical one is a sale ({@link createSale}). Checked first: the patient, the
 * lines, the lowest prices and "Paid now" within the bill; a payment on a
 * closed day is a 409 and nothing is written.
 */
export async function createInvoice(raw: InvoiceInput): Promise<InvoiceSaveResult> {
  const input = validateClinicInput(invoiceInputSchema, raw);
  if (input.type === 'medical') return createSale(input);
  const { paidNow } = checkInput(input, 0);
  if (paidNow > 0) await assertDayOpen(input.branchId, clinicToday());
  const invoice = await world.invoices.create({ ...recordFields(input), saleId: null });
  return afterSave(invoice, input.paidNow);
}

/** The buyer of a sale: the patient, the contact, or the lead saved as a contact. */
async function saleBuyer(input: InvoiceInput) {
  if (input.patientId) return { patientId: input.patientId, medicalContactId: null };
  if (input.medicalContactId) {
    refuseUnknownIds(
      'medicalContactId',
      [input.medicalContactId],
      world.medicalContacts.snapshot(),
      INVOICE_CUSTOMER_MESSAGE,
    );
    return { patientId: null, medicalContactId: input.medicalContactId };
  }
  if (input.leadId) {
    return { patientId: null, medicalContactId: (await contactForLead(input.leadId)).id };
  }
  return refuse('patientId', INVOICE_CUSTOMER_MESSAGE);
}

/** Each medicine's draw, earliest expiry first; a sale over stock is a 409 naming it. */
function saleTakes(input: InvoiceInput, today: string) {
  const wanted = new Map<string, number>();
  for (const line of input.items) {
    if (line.medicineId)
      wanted.set(line.medicineId, (wanted.get(line.medicineId) ?? 0) + line.qty);
  }
  const medicines = world.medicines.snapshot();
  return [...wanted].map(([medicineId, qty]) => {
    const medicine = medicines.find((row) => row.id === medicineId);
    if (!medicine) return refuse('items', 'Pick the medicine again');
    const { takes, short } = fefoTakes(medicine.batches, qty, today);
    if (short > 0) {
      throw clinicHttpError(
        409,
        'conflict',
        `Only ${medicineStock(medicine.batches)} of ${medicine.name} in stock`,
      );
    }
    return { medicine, takes };
  });
}

/**
 * Create a Medical sale (`createSale`, `S:1666`): the buyer (a lead becomes a
 * Medical contact), every medicine in stock — "Only 3 of Glycolac Cream in
 * stock" otherwise — then the sale, its invoice with each line's batch, the
 * stock drawn by earliest expiry, the receipt for "Paid now" and, for a
 * balance, a "Payment due" task.
 */
export async function createSale(raw: InvoiceInput): Promise<InvoiceSaveResult> {
  const input = validateClinicInput(invoiceInputSchema, { ...raw, type: 'medical' });
  const today = clinicToday();
  const { paidNow } = checkInput(input, 0);
  const draws = saleTakes(input, today);
  if (paidNow > 0) await assertDayOpen(input.branchId, today);
  const buyer = await saleBuyer(input);
  const batchOf = new Map(
    draws.map(({ medicine, takes }) => [medicine.id, takes[0]?.batchNo ?? null]),
  );
  const drafted = await world.invoices.create({
    ...recordFields(input),
    ...buyer,
    items: input.items.map((line) => ({
      ...line,
      batchNo: line.medicineId ? (batchOf.get(line.medicineId) ?? null) : null,
    })),
    saleId: null,
  });
  const sale: CreateInput<MedicalSale> = {
    invoiceId: drafted.id,
    patientId: buyer.patientId,
    medicalContactId: buyer.medicalContactId,
    prescriptionId: input.prescriptionId,
    soldAt: new Date().toISOString(),
    voidedAt: null,
    returns: [],
  };
  const saved = await world.medicalSales.create(sale);
  const invoice = await world.invoices.update(drafted.id, { saleId: saved.id });
  for (const { medicine, takes } of draws) {
    await world.medicines.update(medicine.id, {
      batches: withTakes(medicine.batches, takes),
    });
  }
  return afterSave(invoice, input.paidNow);
}

/** A sale's lines are never edited (`S:51`): only who prescribed, the discount, the Remark and a payment. */
function refuseSaleLineChange(saved: InvoiceRecord, input: InvoiceInput): void {
  const same =
    saved.items.length === input.items.length &&
    saved.items.every((line, index) => {
      const next = input.items[index];
      return (
        next !== undefined &&
        next.medicineId === line.medicineId &&
        next.qty === line.qty &&
        next.rate === line.rate &&
        next.discountPct === line.discountPct
      );
    });
  if (!same) {
    throw clinicHttpError(
      409,
      'conflict',
      'A sale’s medicines can’t change · return or void the sale',
    );
  }
}

/**
 * Change an invoice (`updateInvoice`, `S:1716`): its lines, team, discount,
 * date and Remark, and a payment now. The type stays; a sale keeps its
 * medicines. A bill below what is already paid is a 409 (`S:1716`), and so is
 * a payment on a closed day. Packages and plan links follow the new lines.
 */
export async function updateInvoice(
  id: string,
  raw: InvoiceInput,
): Promise<InvoiceSaveResult> {
  const saved = await world.invoices.get(id);
  const input = validateClinicInput(invoiceInputSchema, { ...raw, type: saved.type });
  if (saved.saleId) refuseSaleLineChange(saved, input);
  const alreadyPaid = invoicePaid(saved.id, world.payments.snapshot());
  const { paidNow } = checkInput(input, alreadyPaid);
  if (paidNow > 0) await assertDayOpen(input.branchId, clinicToday());
  const fields = recordFields(input);
  const invoice = await world.invoices.update(id, {
    ...fields,
    patientId: saved.patientId ?? fields.patientId,
    medicalContactId: saved.medicalContactId ?? fields.medicalContactId,
    // A sale's lines keep the batches they were drawn from.
    items: saved.saleId ? saved.items : fields.items,
  });
  return afterSave(invoice, input.paidNow);
}

/**
 * Delete an invoice with the confirm's reason (`S:1546`) — the `void` ability
 * (Q-U8). An invoice with payments against it is refused (refund them first),
 * and a sale's is voided from Medical (`voidSale`). Its unused packages go
 * with it and its plan links come off.
 */
export async function deleteInvoice(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<InvoiceRecord> {
  const saved = await world.invoices.get(id);
  const label = `Invoice ${displayId.invoiceNumber(saved.seq)}`;
  if (saved.saleId)
    throw clinicHttpError(409, 'conflict', `${label} is a sale · void it from Medical`);
  if (invoicePaid(saved.id, world.payments.snapshot()) > 0) {
    throw clinicHttpError(409, 'conflict', `${label} has payments · refund them first`);
  }
  const removed = await world.invoices.remove(id, reason, note);
  for (const pack of world.patientPackages.snapshot((row) => row.invoiceId === id)) {
    if (pack.sessionsUsed === 0)
      await world.patientPackages.remove(pack.id, reason, note);
  }
  await linkPlan({ ...removed, items: [] });
  return removed;
}

/** Bring a deleted invoice back — the Undo of its "deleted" toast (D32): packages and plan links too. */
export async function restoreInvoice(id: string): Promise<InvoiceRecord> {
  const restored = await world.invoices.restore(id);
  await syncPackages(restored);
  await linkPlan(restored);
  return restored;
}
