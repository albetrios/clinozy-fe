import type {
  CommandSearchInvoice,
  CommandSearchLead,
  CommandSearchPatient,
  CommandSearchResult,
} from './command-search-contracts.ts';

/*
 * ⌘K's search (`commandSearch`, `S:1565`) on the fixture world until
 * clinozy-be serves it — REPLACE_WITH_API (D6). The world is imported on
 * demand, so its seed data never lands in the palette's chunk.
 */

/** The shortest query the search runs for (`S:1565`: `q` ≥ 2 characters). */
export const COMMAND_SEARCH_MIN_LENGTH = 2;

/** Hits returned per type (`S:1565`); the menu shows fewer per group. */
export const COMMAND_SEARCH_PER_TYPE = 10;

/** A query matches phone numbers from this many digits (H:4605). */
export const COMMAND_SEARCH_MIN_PHONE_DIGITS = 3;

/** TanStack Query keys for ⌘K's search. */
export const commandSearchQueryKeys = {
  all: ['clinic', 'command-search'] as const,
  search: (query: string) => [...commandSearchQueryKeys.all, query] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

const EMPTY_RESULT: CommandSearchResult = { patients: [], leads: [], invoices: [] };

/** Whether a query is long enough to search (trimmed, `S:1565`). */
export function isCommandSearchQuery(query: string): boolean {
  return query.trim().length >= COMMAND_SEARCH_MIN_LENGTH;
}

/** An Indian mobile's national digits — "+91 98250 44120" and "98250 44120" alike. */
function nationalDigits(value: string): string {
  return value.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
}

/** A query's phone digits; a "+91" typed in front of a number being entered is not one of them. */
function queryDigits(text: string): string {
  return /^\+\s*91/.test(text) ? text.replace(/\D/g, '').slice(2) : nationalDigits(text);
}

/** What a query looks for: its lowercase text, and its digits once there are enough of them. */
interface SearchNeedle {
  text: string;
  digits: string | null;
}

function needleOf(query: string): SearchNeedle {
  const text = query.trim().toLowerCase();
  const digits = queryDigits(text);
  return {
    text,
    digits: digits.length >= COMMAND_SEARCH_MIN_PHONE_DIGITS ? digits : null,
  };
}

/**
 * Whether a record matches ⌘K's query the way the prototype matches it
 * (H:4605–4607): a name containing the text, a phone containing its digits
 * (three or more), or the display id — "#3508", "3508" or a part of it.
 */
export function matchesCommandSearch(
  record: { names: readonly string[]; phone?: string | null; seq: number },
  query: string,
): boolean {
  const needle = needleOf(query);
  if (!needle.text) return false;
  return (
    record.names.some((name) => name.toLowerCase().includes(needle.text)) ||
    (needle.digits !== null &&
      !!record.phone &&
      nationalDigits(record.phone).includes(needle.digits)) ||
    `#${record.seq}`.includes(needle.text)
  );
}

const fullName = (person: { firstName: string; lastName: string | null }) =>
  [person.firstName, person.lastName].filter(Boolean).join(' ');

const newestFirst = (a: { seq: number }, b: { seq: number }) => b.seq - a.seq;

/**
 * Search patients, leads and invoices for ⌘K (`commandSearch`, `S:1565`;
 * REPLACE_WITH_API): up to ten of each, newest first. Patients match by name,
 * phone or id; leads the same, never a contact thread (H:4606); invoices by
 * id or the person billed. Below two characters nothing is searched.
 */
export async function searchClinicCommands(query: string): Promise<CommandSearchResult> {
  if (!isCommandSearchQuery(query)) return EMPTY_RESULT;
  const { clinicFixtures } = await fixtureWorld();
  const patients = clinicFixtures.patients.snapshot();

  const patientHits: CommandSearchPatient[] = patients
    .filter((patient) =>
      matchesCommandSearch(
        { names: [fullName(patient)], phone: patient.phone, seq: patient.seq },
        query,
      ),
    )
    .sort(newestFirst)
    .slice(0, COMMAND_SEARCH_PER_TYPE)
    .map((patient) => ({
      id: patient.id,
      seq: patient.seq,
      phone: patient.phone,
      types: patient.types,
      name: fullName(patient),
    }));

  const leadHits: CommandSearchLead[] = clinicFixtures.leads
    .snapshot((lead) => lead.kind !== 'contact_thread' && !lead.isContactThread)
    .filter((lead) =>
      matchesCommandSearch(
        { names: [lead.name], phone: lead.phone, seq: lead.seq },
        query,
      ),
    )
    .sort(newestFirst)
    .slice(0, COMMAND_SEARCH_PER_TYPE)
    .map(({ id, seq, name, status, kind, phone }) => ({
      id,
      seq,
      name,
      status,
      kind,
      phone,
    }));

  const patientNames = new Map(
    patients.map((patient) => [patient.id, fullName(patient)]),
  );
  const contactNames = new Map(
    clinicFixtures.medicalContacts
      .snapshot()
      .map((contact) => [contact.id, contact.name]),
  );
  const invoiceHits: CommandSearchInvoice[] = clinicFixtures.invoices
    .snapshot()
    .map((invoice) => ({
      invoice,
      personName:
        (invoice.patientId && patientNames.get(invoice.patientId)) ||
        (invoice.medicalContactId && contactNames.get(invoice.medicalContactId)) ||
        null,
    }))
    .filter(({ invoice, personName }) =>
      matchesCommandSearch(
        { names: personName ? [personName] : [], seq: invoice.seq },
        query,
      ),
    )
    .sort((a, b) => newestFirst(a.invoice, b.invoice))
    .slice(0, COMMAND_SEARCH_PER_TYPE)
    .map(({ invoice, personName }) => ({
      id: invoice.id,
      seq: invoice.seq,
      type: invoice.type,
      date: invoice.date,
      personName,
    }));

  return { patients: patientHits, leads: leadHits, invoices: invoiceHits };
}
