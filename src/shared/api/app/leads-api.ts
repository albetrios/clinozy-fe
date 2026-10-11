import { z } from 'zod';

import { api } from '@/core/http/api.ts';

import { createdRangeOf, followUpRangeOf } from './app-filter-ranges.ts';
import type { DeleteReason } from './app-schema.ts';
import { appToday } from './app-time.ts';
import type { ContactFields } from './contacts-contracts.ts';
import { contactBodyOf } from './contacts-contracts.ts';
import {
  type ApiLeadCreate,
  leadBodyOf,
  type LeadFields,
  type LeadListParams,
  type LeadRecord,
  leadRowWire,
  leadWire,
  toLeadRecord,
} from './leads-contracts.ts';

/*
 * The Leads domain on clinozy-be (`/app/leads`, api-integration §5.2): the list with its views,
 * filters and sorts, one lead, the Unreplied count, create (for a contact, or with a new one),
 * a change that carries the read's `updated_at`, claim and release, delete with its reason and
 * restore. Every write carries the action's key.
 */

/** TanStack Query keys for the leads, each carrying the organization. */
export const leadQueryKeys = {
  all: ['app', 'leads'] as const,
  /** Every list variant — a write invalidates them all. */
  lists: (organizationId: string | null) =>
    [...leadQueryKeys.all, organizationId, 'list'] as const,
  list: (organizationId: string | null, params: LeadListParams) =>
    [...leadQueryKeys.lists(organizationId), params] as const,
  detail: (organizationId: string | null, leadId: string) =>
    [...leadQueryKeys.all, organizationId, 'detail', leadId] as const,
  /** Every Unreplied count — a write refreshes them. */
  unrepliedCounts: (organizationId: string | null) =>
    [...leadQueryKeys.all, organizationId, 'unreplied'] as const,
  /** The Unreplied tab's count chip. */
  unreplied: (organizationId: string | null, viewerId: string | null) =>
    [...leadQueryKeys.unrepliedCounts(organizationId), viewerId] as const,
  /** A lead's open tasks — the drawer's Info count. */
  openTasks: (organizationId: string | null, leadId: string) =>
    [...leadQueryKeys.all, organizationId, 'open-tasks', leadId] as const,
};

/** One page of the list — the design's 50. */
const PAGE_SIZE = 50;

/** The list's sort keys as the API names them. */
const SORTS = {
  name: 'name',
  status: 'status',
  source: 'source',
  activity: 'last_activity_at',
} as const;

/** The Ownership filter as the API names it. */
const OWNERSHIP = { open: 'open', soon: 'releasing_today', held: 'held' } as const;

/** The list read's query for the URL's params, on the clinic's `today`. */
export function leadListQuery(params: LeadListParams, today: string = appToday()) {
  const mine = params.view !== 'all' ? (params.viewerId ?? undefined) : undefined;
  const created = params.created ? createdRangeOf(params.created, today) : {};
  const followUp = params.followUp ? (followUpRangeOf(params.followUp, today) ?? {}) : {};
  return {
    limit: PAGE_SIZE,
    q: params.q,
    owner_membership_id: mine,
    is_awaiting_reply: params.view === 'unreplied' ? ('true' as const) : undefined,
    status: params.status,
    source: params.source?.length ? params.source.join(',') : undefined,
    ownership: params.hold ? OWNERSHIP[params.hold] : undefined,
    team_membership_id: params.member,
    created_from: created.from,
    created_to: created.to,
    follow_up_at_from: followUp.from,
    follow_up_at_to: followUp.to,
    sort: params.sort ? SORTS[params.sort] : undefined,
    order: params.sort ? params.order : undefined,
  };
}

/** One page of the leads list for the URL's params; `after` is the previous page's cursor. */
export async function listLeads(
  params: LeadListParams,
  after?: string,
): Promise<{ rows: LeadRecord[]; next: string | null; total: number | null }> {
  const response = await api.get('/app/leads', {
    query: { ...leadListQuery(params), after },
  });
  const pagination = response.meta?.pagination;
  return {
    rows: z
      .array(leadRowWire)
      .parse(response.data ?? [])
      .map(toLeadRecord),
    next: pagination?.has_more ? (pagination.next ?? null) : null,
    total: pagination?.estimated_total ?? null,
  };
}

/** One lead — a 404 when it is gone or in a branch the member cannot see. */
export async function fetchLead(leadId: string): Promise<LeadRecord> {
  const response = await api.get('/app/leads/{lead_id}', { params: { lead_id: leadId } });
  return toLeadRecord(leadWire.parse(response.data));
}

/** The Unreplied tab's count: the viewer's leads whose person waits for a reply. */
export async function countUnrepliedLeads(viewerId: string | null): Promise<number> {
  if (!viewerId) return 0;
  const response = await api.get('/app/leads', {
    query: { limit: 1, owner_membership_id: viewerId, is_awaiting_reply: 'true' },
  });
  return response.meta?.pagination?.estimated_total ?? response.data?.length ?? 0;
}

/** How many open tasks point at a lead — the drawer's Info count. */
export async function countOpenLeadTasks(leadId: string): Promise<number> {
  const response = await api.get('/app/tasks', {
    query: { limit: 1, tab: 'open', scope: 'everyone', lead_id: leadId },
  });
  return response.meta?.pagination?.estimated_total ?? response.data?.length ?? 0;
}

/** Who a new lead is for: someone already known, or a new person. */
export type LeadPersonInput = { contactId: string } | { contact: ContactFields };

/**
 * A new lead — `409 lead_open_exists` when the person already has an open lead,
 * `409 contact_phone_exists` when a new person's number is someone else's.
 */
export async function createLead({
  person,
  fields,
  idempotencyKey,
}: {
  person: LeadPersonInput;
  fields: LeadFields;
  idempotencyKey: string;
}): Promise<LeadRecord> {
  const who: Pick<ApiLeadCreate, 'contact_id' | 'contact'> =
    'contactId' in person
      ? { contact_id: person.contactId }
      : { contact: contactBodyOf(person.contact) };
  const response = await api.post('/app/leads', {
    body: { ...who, ...leadBodyOf(fields) },
    idempotencyKey,
  });
  return toLeadRecord(leadWire.parse(response.data));
}

/**
 * A change to a lead. A drawer save sends the read's `updated_at` and is refused
 * (`409 record_changed`) when the lead changed since; a quick toggle (the team popover) sends none.
 */
export async function updateLead({
  leadId,
  fields,
  expectedUpdatedAt,
  idempotencyKey,
}: {
  leadId: string;
  fields: Partial<LeadFields>;
  expectedUpdatedAt?: string;
  idempotencyKey: string;
}): Promise<LeadRecord> {
  const response = await api.patch('/app/leads/{lead_id}', {
    params: { lead_id: leadId },
    body: { ...leadBodyOf(fields), expected_updated_at: expectedUpdatedAt },
    idempotencyKey,
  });
  return toLeadRecord(leadWire.parse(response.data));
}

/** Claim an open lead — the member owns and holds it (`409` when someone else holds it). */
export async function claimLead(
  leadId: string,
  idempotencyKey: string,
): Promise<LeadRecord> {
  const response = await api.post('/app/leads/{lead_id}/claim', {
    params: { lead_id: leadId },
    idempotencyKey,
  });
  return toLeadRecord(leadWire.parse(response.data));
}

/** Let a held lead go back to the team. */
export async function releaseLead(
  leadId: string,
  idempotencyKey: string,
): Promise<LeadRecord> {
  const response = await api.post('/app/leads/{lead_id}/release', {
    params: { lead_id: leadId },
    idempotencyKey,
  });
  return toLeadRecord(leadWire.parse(response.data));
}

/** Delete a lead with the reason the member picked (restorable for the clinic's purge window). */
export async function deleteLead({
  leadId,
  reason,
  note,
}: {
  leadId: string;
  reason: DeleteReason;
  note: string | null;
}): Promise<void> {
  await api.delete('/app/leads/{lead_id}', {
    params: { lead_id: leadId },
    reason,
    note: note ?? undefined,
  });
}

/** Bring a deleted lead back. */
export async function restoreLead(
  leadId: string,
  idempotencyKey: string,
): Promise<LeadRecord> {
  const response = await api.post('/app/leads/{lead_id}/restore', {
    params: { lead_id: leadId },
    idempotencyKey,
  });
  return toLeadRecord(leadWire.parse(response.data));
}
