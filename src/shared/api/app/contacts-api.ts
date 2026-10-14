import { z } from 'zod';

import { api } from '@/core/http/api.ts';

import {
  type Contact,
  contactBodyOf,
  type ContactFields,
  type ContactHit,
  type ContactProfile,
  contactRowWire,
  type ContactSummary,
  contactWire,
  toContact,
  toContactProfile,
  toContactSummary,
} from './contacts-contracts.ts';

/*
 * The person on clinozy-be (`/app/contacts`, api-integration §3): one read with every number, a
 * search, and a change that carries the read's `updated_at` (a stale one is
 * `409 record_changed`). A new person is created with their lead (`POST /app/leads`), or on
 * their own before a booking (`POST /app/contacts`).
 */

/** TanStack Query keys for contacts, each carrying the organization. */
export const contactQueryKeys = {
  all: ['app', 'contacts'] as const,
  one: (organizationId: string | null, contactId: string) =>
    [...contactQueryKeys.all, organizationId, 'one', contactId] as const,
  search: (
    organizationId: string | null,
    query: string,
    scope: ContactScope = 'everyone',
  ) => [...contactQueryKeys.all, organizationId, 'search', scope, query] as const,
  recent: (organizationId: string | null, scope: ContactScope = 'everyone') =>
    [...contactQueryKeys.all, organizationId, 'recent', scope] as const,
};

/**
 * Whom a people search reads: everyone the clinic knows, or only those with a patient file
 * (`is_patient=true` — the patient fields of Receive payment and the Invoice drawer).
 */
export type ContactScope = 'everyone' | 'patients';

/** The list filter a scope adds. */
const scopeQuery = (scope: ContactScope) =>
  scope === 'patients' ? { is_patient: 'true' as const } : {};

/** The most a search answers with. */
const SEARCH_LIMIT = 8;

/** The most people "Recent" shows before anything is typed (change-contact-quick-pick D7). */
const RECENT_CONTACTS_LIMIT = 5;

/** One contact with every number (`GET /app/contacts/:contact_id`). */
export async function fetchContact(contactId: string): Promise<Contact> {
  const response = await api.get('/app/contacts/{contact_id}', {
    params: { contact_id: contactId },
  });
  return toContact(contactWire.parse(response.data));
}

async function listContacts(query: {
  q?: string;
  limit: number;
  sort?: 'last_activity_at';
  order?: 'desc';
  is_patient?: 'true';
}): Promise<ContactHit[]> {
  const response = await api.get('/app/contacts', { query });
  return z
    .array(contactRowWire)
    .parse(response.data ?? [])
    .map((row) => ({ ...toContactSummary(row), patientNumber: row.patient_number }));
}

/** The most ids one `GET /app/contacts?ids=` takes (CT12). */
const IDS_PER_READ = 100;

/**
 * The people behind a page of records that point at them (`contact_id`) — a patients page's
 * names, numbers and birth dates — by id; an id the API does not answer for is left out.
 */
export async function fetchContactsByIds(
  ids: readonly string[],
): Promise<Map<string, ContactSummary & ContactProfile>> {
  const unique = [...new Set(ids)];
  const people = new Map<string, ContactSummary & ContactProfile>();
  for (let start = 0; start < unique.length; start += IDS_PER_READ) {
    const chunk = unique.slice(start, start + IDS_PER_READ);
    const response = await api.get('/app/contacts', {
      query: { ids: chunk.join(','), limit: chunk.length },
    });
    for (const row of z.array(contactRowWire).parse(response.data ?? [])) {
      people.set(row.id, { ...toContactSummary(row), ...toContactProfile(row) });
    }
  }
  return people;
}

/**
 * The person on a number (E.164), if the clinic knows one, with their file's number — the
 * patient drawer's duplicate check.
 */
export async function findContactByPhone(
  phone: string,
): Promise<(ContactSummary & ContactProfile) | null> {
  const response = await api.get('/app/contacts', { query: { phone, limit: 1 } });
  const [row] = z.array(contactRowWire).parse(response.data ?? []);
  return row ? { ...toContactSummary(row), ...toContactProfile(row) } : null;
}

/** A whole contact number: "C-12345", "c12345", "#12345". */
const CONTACT_NUMBER_QUERY = /^(?:c-?|#)\s*\d{1,9}$/i;
/** A typed number: digits with the separators people type ("+91 98765-43210"). */
const PHONE_QUERY = /^[\d\s+().-]+$/;

/** A typed number's own digits, without a leading `+91`. */
function localDigitsOf(typed: string): string {
  const digits = typed.replace(/\D/g, '');
  return typed.startsWith('+91') ? digits.slice(2) : digits;
}

/**
 * Whether the API takes this as a search (CT9): a whole contact number, a number with 4+ digits
 * of its own, or text of 3+ characters — anything shorter is its 400 `contactSearchTooShort`.
 */
export function isContactSearchable(typed: string): boolean {
  const q = typed.trim();
  if (CONTACT_NUMBER_QUERY.test(q)) return true;
  if (PHONE_QUERY.test(q) && /\d/.test(q)) return localDigitsOf(q).length >= 4;
  return q.length >= 3;
}

/**
 * People matching what was typed — 3+ letters of a name or handle, 4+ digits of a number, or a
 * whole contact number (`C-12345`); best match first — among everyone, or only patients (`scope`).
 * Anything shorter answers nothing, unasked.
 */
export async function searchContacts(
  typed: string,
  scope: ContactScope = 'everyone',
): Promise<ContactHit[]> {
  const q = typed.trim();
  if (!isContactSearchable(q)) return [];
  return listContacts({ q, limit: SEARCH_LIMIT, ...scopeQuery(scope) });
}

/**
 * The people the clinic was last in touch with (`GET /app/contacts?sort=last_activity_at`) —
 * newest activity first, anyone without activity last; a picker's "Recent" before anything is
 * typed — everyone, or only patients (`scope`).
 */
export async function fetchRecentContacts(
  scope: ContactScope = 'everyone',
): Promise<ContactHit[]> {
  return listContacts({
    sort: 'last_activity_at',
    order: 'desc',
    limit: RECENT_CONTACTS_LIMIT,
    ...scopeQuery(scope),
  });
}

/**
 * A new person (`POST /app/contacts`) — what a booking for someone the search did not find
 * points at; `409 contact_phone_exists` when the number is someone else's.
 */
export async function createContact({
  fields,
  idempotencyKey,
}: {
  fields: ContactFields;
  idempotencyKey: string;
}): Promise<Contact> {
  const response = await api.post('/app/contacts', {
    body: contactBodyOf(fields),
    idempotencyKey,
  });
  return toContact(contactWire.parse(response.data));
}

/** A change to a contact, refused (`409 record_changed`) when it changed since `expectedUpdatedAt`. */
export async function updateContact({
  contactId,
  fields,
  expectedUpdatedAt,
  idempotencyKey,
}: {
  contactId: string;
  fields: ContactFields;
  expectedUpdatedAt: string;
  idempotencyKey: string;
}): Promise<Contact> {
  const response = await api.patch('/app/contacts/{contact_id}', {
    params: { contact_id: contactId },
    body: { ...contactBodyOf(fields), expected_updated_at: expectedUpdatedAt },
    idempotencyKey,
  });
  return toContact(contactWire.parse(response.data));
}
