import { z } from 'zod';

import { api } from '@/core/http/api.ts';

import {
  type Contact,
  contactBodyOf,
  type ContactFields,
  contactRowWire,
  type ContactSummary,
  contactWire,
  toContact,
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
  all: ['clinic', 'contacts'] as const,
  one: (organizationId: string | null, contactId: string) =>
    [...contactQueryKeys.all, organizationId, 'one', contactId] as const,
  search: (organizationId: string | null, query: string) =>
    [...contactQueryKeys.all, organizationId, 'search', query] as const,
};

/** The most a search answers with. */
const SEARCH_LIMIT = 8;

/** One contact with every number (`GET /app/contacts/:contact_id`). */
export async function fetchContact(contactId: string): Promise<Contact> {
  const response = await api.get('/app/contacts/{contact_id}', {
    params: { contact_id: contactId },
  });
  return toContact(contactWire.parse(response.data));
}

async function listContacts(query: {
  q?: string;
  phone?: string;
  ids?: string;
  limit: number;
}): Promise<ContactSummary[]> {
  const response = await api.get('/app/contacts', { query });
  return z
    .array(contactRowWire)
    .parse(response.data ?? [])
    .map(toContactSummary);
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
 * whole contact number (`C-12345`); best match first. Anything shorter answers nothing, unasked.
 */
export async function searchContacts(typed: string): Promise<ContactSummary[]> {
  const q = typed.trim();
  if (!isContactSearchable(q)) return [];
  return listContacts({ q, limit: SEARCH_LIMIT });
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
