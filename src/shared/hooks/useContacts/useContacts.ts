import { keepPreviousData } from '@tanstack/react-query';

import {
  contactQueryKeys,
  type ContactScope,
  createContact,
  fetchContact,
  fetchRecentContacts,
  isContactSearchable,
  searchContacts,
  updateContact,
} from '@/shared/api/app/contacts-api.ts';
import type {
  Contact,
  ContactFields,
  ContactHit,
} from '@/shared/api/app/contacts-contracts.ts';
import { leadQueryKeys } from '@/shared/api/app/leads-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useDebouncedSearch } from '@/shared/hooks/useDebouncedValue/index.ts';
import { useOrganizationId } from '@/shared/store/useOrganizationStore/index.ts';

/*
 * The person on clinozy-be (`/app/contacts`): one contact with every number, the person search
 * New lead and the pickers read, a new person before their booking, and the contact editor's
 * save.
 */

/** One contact with every number; idle without an id. */
export function useContact(contactId: string | undefined) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: contactQueryKeys.one(organizationId, contactId ?? ''),
    queryFn: () => fetchContact(contactId ?? ''),
    enabled: Boolean(contactId),
  });
}

/** The person search waits this long after the last keystroke (as ⌘K's, KICKOFF §6.0 Timers). */
const CONTACT_SEARCH_DEBOUNCE_MS = 250;

/** A person search as a picker reads it. */
export interface ContactSearch {
  /** The people for the query as typed — or, while it loads, for the last one asked. */
  hits: readonly ContactHit[];
  /** The query as typed has its answer and it is empty: "No existing match". */
  noMatch: boolean;
  /**
   * The query is a search and its answer is not in yet — the debounce is still catching up or
   * the read is in flight (the picker's spinner and progress line).
   */
  searching: boolean;
}

/**
 * The person search (`GET /app/contacts?q=`): debounced 250ms, from 3 letters or 4 digits, among
 * everyone or only patients (`scope`); the previous answer stays up while the next one loads, and
 * `searching` says one is on its way.
 */
export function useContactSearch(
  query: string,
  scope: ContactScope = 'everyone',
): ContactSearch {
  const organizationId = useOrganizationId();
  const typed = query.trim();
  const { debounced, isPending } = useDebouncedSearch(typed, CONTACT_SEARCH_DEBOUNCE_MS);
  const search = useAppQuery({
    queryKey: contactQueryKeys.search(organizationId, debounced.toLowerCase(), scope),
    queryFn: () => searchContacts(debounced, scope),
    enabled: isContactSearchable(debounced),
    placeholderData: keepPreviousData,
  });
  const live = isContactSearchable(typed);
  const hits = live ? (search.data ?? []) : [];
  const settled = live && !isPending && debounced === typed && !search.isPlaceholderData;
  return {
    hits,
    noMatch: settled && search.isSuccess && hits.length === 0,
    searching: live && (!settled || search.isFetching),
  };
}

/** The people a picker shows before anything is typed. */
export interface RecentContacts {
  people: readonly ContactHit[];
  /** The first read is in flight (its shimmer rows). */
  loading: boolean;
}

/**
 * "Recent" (`GET /app/contacts?sort=last_activity_at`, change-contact-quick-pick D7): the five
 * people — or patients (`scope`) — the clinic was last in touch with; idle while `enabled` is
 * off, quiet on failure (the search still works, so no toast), fresh for 30s.
 */
export function useRecentContacts(
  enabled: boolean,
  scope: ContactScope = 'everyone',
): RecentContacts {
  const organizationId = useOrganizationId();
  const recent = useAppQuery({
    queryKey: contactQueryKeys.recent(organizationId, scope),
    queryFn: () => fetchRecentContacts(scope),
    enabled,
    staleTime: 30_000,
    notifyOnError: false,
  });
  return { people: recent.data ?? [], loading: enabled && recent.isPending };
}

/** What a contact save sends: the contact as read and its edited fields. */
export interface ContactUpdateVars {
  contact: Contact;
  fields: ContactFields;
}

/**
 * Save a person (`PATCH /app/contacts/:contact_id`) — refused when someone saved them meanwhile
 * (`409 record_changed`, the error mapper's "Reload"). The leads that show them refresh.
 */
export function useUpdateContact(
  options: CrudMutationOptions<Contact, ContactUpdateVars> = {},
) {
  return useAppMutation<Contact, ContactUpdateVars>({
    mutationFn: ({ contact, fields }, action) =>
      updateContact({
        contactId: contact.id,
        fields,
        expectedUpdatedAt: contact.updatedAt,
        ...action,
      }),
    invalidateKeys: [contactQueryKeys.all, leadQueryKeys.all],
    ...options,
  });
}

/**
 * A new person (`POST /app/contacts`) — the appointment form books someone the search did not
 * find; silent, the booking's toast says it. `409 contact_phone_exists` shows the server's words.
 */
export function useCreateContact(
  options: CrudMutationOptions<Contact, ContactFields> = {},
) {
  return useAppMutation<Contact, ContactFields>({
    mutationFn: (fields, action) => createContact({ fields, ...action }),
    invalidateKeys: [contactQueryKeys.all],
    ...options,
  });
}
