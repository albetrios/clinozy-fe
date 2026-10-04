import type { CursorPage } from './clinic-fixture-store.ts';
import {
  COMMAND_SEARCH_PER_TYPE,
  isCommandSearchQuery,
  matchesCommandSearch,
} from './command-search-api.ts';
import { listPatients } from './patients-api.ts';
import { patientName } from './patients-contracts.ts';

/*
 * The patient field's search (Receive payment, the Invoice drawer — KICKOFF
 * §6.9): patients by name, mobile or display id through `listPatients`
 * (`S:1619`), each with its dues, and — once the patients run out — the leads
 * the same text finds that are not patients yet, which the field shows but
 * will not take ("Lead #2363 · not a patient yet"). On the fixture world until
 * clinozy-be serves it — REPLACE_WITH_API (D6).
 */

/** One row of the patient field's list: a patient it can take, or a lead it can't. */
export type PatientPickRow =
  | {
      kind: 'patient';
      id: string;
      seq: number;
      name: string;
      phone: string | null;
      /** Everything the patient still owes, in paise. */
      due: number;
    }
  | { kind: 'lead'; id: string; seq: number; name: string };

/** TanStack Query keys for the patient field's pages. */
export const patientPickerQueryKeys = {
  all: ['clinic', 'patient-picker'] as const,
};

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

/** The leads `query` finds that never became patients — ten at most, newest first. */
async function leadsNotPatients(query: string): Promise<PatientPickRow[]> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.leads
    .snapshot(
      (lead) =>
        lead.kind !== 'contact_thread' &&
        !lead.isContactThread &&
        lead.patientId === null &&
        matchesCommandSearch(
          { names: [lead.name], phone: lead.phone, seq: lead.seq },
          query,
        ),
    )
    .sort((a, b) => b.seq - a.seq)
    .slice(0, COMMAND_SEARCH_PER_TYPE)
    .map((lead) => ({ kind: 'lead', id: lead.id, seq: lead.seq, name: lead.name }));
}

/**
 * One page of the patient field's list: patients A–Z matching `query` (all of
 * them for an empty one), then — on the last page, for a query of two or more
 * characters — the leads it matches that are not patients yet.
 */
export async function searchPatientPicker(
  query: string,
  cursor: string | null = null,
): Promise<CursorPage<PatientPickRow>> {
  const text = query.trim();
  const page = await listPatients(
    { q: text || undefined, sort: 'name', order: 'asc' },
    cursor,
  );
  const patients: PatientPickRow[] = page.items.map((row) => ({
    kind: 'patient',
    id: row.id,
    seq: row.seq,
    name: patientName(row),
    phone: row.phone,
    due: row.dueTotal,
  }));
  const leads =
    page.nextCursor === null && isCommandSearchQuery(text)
      ? await leadsNotPatients(text)
      : [];
  return { items: [...patients, ...leads], nextCursor: page.nextCursor };
}
