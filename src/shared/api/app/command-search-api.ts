import { z } from 'zod';

import { api } from '@/core/http/api.ts';

import type { CommandSearchResult } from './command-search-contracts.ts';
import { isContactSearchable } from './contacts-api.ts';
import { contactNameOf, contactRowWire } from './contacts-contracts.ts';

/*
 * ⌘K's search (`commandSearch`; api-integration §5.11, §6 #1; D158) on clinozy-be: the people
 * `GET /app/contacts?q=` finds — 3+ letters of a name or handle, 4+ digits of a number, or a
 * whole contact number — best match first. Patients, leads and invoices are no longer searched
 * apart: a person opens their patient file or their open lead.
 */

/** People one search answers with; the menu shows them all. */
export const COMMAND_SEARCH_LIMIT = 8;

/** TanStack Query keys for ⌘K's search. */
export const commandSearchQueryKeys = {
  all: ['app', 'command-search'] as const,
  search: (query: string) => [...commandSearchQueryKeys.all, query] as const,
};

/** Whether ⌘K searches what was typed — the contacts search's own rule (CT9). */
export function isCommandSearchQuery(query: string): boolean {
  return isContactSearchable(query);
}

/** The people who match `query`; none below the search's minimum, unasked. */
export async function searchAppCommands(query: string): Promise<CommandSearchResult> {
  const q = query.trim();
  if (!isCommandSearchQuery(q)) return { people: [] };
  const response = await api.get('/app/contacts', {
    query: { q, limit: COMMAND_SEARCH_LIMIT },
  });
  const people = z
    .array(contactRowWire)
    .parse(response.data ?? [])
    .map((row) => ({
      id: row.id,
      name: contactNameOf(row),
      contactNumber: row.contact_number,
      phone: row.primary_phone,
      patientId: row.patient_id,
      patientNumber: row.patient_number,
      openLeadId: row.open_lead_id,
    }));
  return { people };
}
