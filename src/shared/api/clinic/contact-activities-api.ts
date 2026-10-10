import { z } from 'zod';

import { api, type ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';
import { toneForLabel } from '@/shared/clinic/clinic-tones.ts';
import { personInitials } from '@/shared/components/Cells/PersonAvatar/person-name.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { ensureMyOrganizationSummaries } from '@/shared/tenancy/my-organization-summaries.ts';

import type { Channel } from './clinic-schema.ts';
import { fetchMemberNames } from './directory-api.ts';
import type {
  ChatAuthor,
  ChatMessage,
  ChatTemplateValues,
  ChatThreadRead,
  ComposerMode,
  MessagingStatus,
} from './messages-contracts.ts';

/*
 * A person's stream on clinozy-be (`/app/contacts/:contact_id/activities`, api-integration
 * §3.3): their WhatsApp and Instagram messages, the calls and notes the team logged and the
 * server's own entries, oldest first — the chat column's thread for a contact. Sending writes
 * one entry (`send-message`, `log-call`, `add-note`); a failed message is queued again
 * (`resend`); `messaging-status` says whether messages go out. The design's SMS and e-mail are
 * not channels (route map §4 #8). The patient file reads the same stream a page at a time,
 * newest first, filtered by `type` and `group` — its Overview timeline and its Team notes
 * (§6 #2, #3: there is no separate patient timeline and no patient note).
 */

type ApiActivity = NonNullable<
  ApiData<'/app/contacts/{contact_id}/activities', 'get'>
>[number];

/** The stream's entry types. */
const ACTIVITY_TYPES = ['whatsapp', 'instagram', 'call_log', 'note', 'system'] as const;

/** One entry type: a message, a logged call, a team note, or the server's own record event. */
type ContactActivityType = (typeof ACTIVITY_TYPES)[number];

/**
 * The stream's groups as the server derives them (M10): every message, call and note is
 * `messages`; a `system` entry goes by the record it links — `clinical`, `money`, `tasks`.
 */
const ACTIVITY_GROUPS = ['messages', 'clinical', 'money', 'tasks'] as const;

/** One group of the stream. */
type ContactActivityGroup = (typeof ACTIVITY_GROUPS)[number];

/** The record an entry is about — at most one of the twelve links is set (M5). */
const ACTIVITY_LINKS = {
  appointment_id: 'appointment',
  invoice_id: 'invoice',
  payment_id: 'payment',
  patient_prescription_id: 'prescription',
  patient_offering_id: 'offering',
  patient_review_id: 'review',
  patient_check_in_id: 'checkIn',
  task_id: 'task',
  patient_treatment_id: 'treatment',
  patient_clinical_note_id: 'clinicalNote',
  patient_image_id: 'image',
  patient_report_id: 'report',
} as const;

/** What kind of record an entry links. */
export type ContactActivityLinkKind =
  (typeof ACTIVITY_LINKS)[keyof typeof ACTIVITY_LINKS];

/** An entry of the stream as the patient file reads it — the server's words, its record link. */
export interface ContactActivityEntry {
  id: string;
  type: ContactActivityType;
  group: ContactActivityGroup;
  /** The text: a message, a note, or the server's own line ("Treatment recorded: Peel"). */
  body: string;
  occurredAt: string;
  /** The member who wrote it (a note, a sent message); none for the server's entries. */
  authorId: string | null;
  link: { kind: ContactActivityLinkKind; id: string } | null;
}

/** What a stream read asks for: entry types and groups, each any of several (`a,b`). */
export interface ContactActivityFilter {
  type?: readonly ContactActivityType[];
  group?: readonly ContactActivityGroup[];
}

/** One page of the stream, newest first, with the server's total on the first page. */
export interface ContactActivityPage {
  rows: ContactActivityEntry[];
  next: string | null;
  hasMore: boolean;
  /** `meta.pagination.estimated_total`; null when the page does not say. */
  total: number | null;
}

/** A filter as the list's query takes it: comma-separated values, none left out. */
function filterQuery(filter: ContactActivityFilter): { type?: string; group?: string } {
  return {
    ...(filter.type?.length ? { type: filter.type.join(',') } : {}),
    ...(filter.group?.length ? { group: filter.group.join(',') } : {}),
  };
}

/**
 * TanStack Query keys for the stream reads — under the messaging domain's key
 * (`['clinic', 'messages']`, `messageQueryKeys` in `messages-api.ts`, named here so this module
 * does not load the fixture world), so every write that refreshes a person's thread refreshes
 * them too; each carries the organization and the contact.
 */
export const contactActivityQueryKeys = {
  all: ['clinic', 'messages', 'activities'] as const,
  /** Everything read of one person's stream. */
  contact: (organizationId: string | null, contactId: string) =>
    [...contactActivityQueryKeys.all, organizationId, contactId] as const,
  /** The pages of one filter; without `limit`, every page size of it. */
  list: (
    organizationId: string | null,
    contactId: string,
    filter: ContactActivityFilter,
    limit?: number,
  ) =>
    [
      ...contactActivityQueryKeys.contact(organizationId, contactId),
      'list',
      filterQuery(filter),
      ...(limit === undefined ? [] : [limit]),
    ] as const,
};

const activityWire = wireSchema<ApiActivity>()(
  z.object({
    id: z.string(),
    type: z.enum(ACTIVITY_TYPES),
    direction: z.enum(['sent', 'received']).nullable(),
    body: z.string(),
    delivery_status: z.enum(['queued', 'sent', 'delivered', 'read', 'failed']).nullable(),
    occurred_at: z.string(),
    author_membership_id: z.string().nullable(),
    task_id: z.string().nullable(),
  }),
);

/**
 * `messaging-status` as its route describes it — the OpenAPI document gives its 200 no body
 * (api-integration §9), so there is no generated type to check this against.
 */
const messagingStatusWire = z.object({
  is_delivery_enabled: z.boolean(),
  is_provider_down: z.boolean(),
  whatsapp: z.object({ is_connected: z.boolean(), queued_count: z.number() }),
  instagram: z.object({ is_connected: z.boolean(), queued_count: z.number() }),
});

/** Each entry type as the chat column's channel. */
const CHANNEL_OF: Readonly<Record<(typeof ACTIVITY_TYPES)[number], Channel>> = {
  whatsapp: 'whatsapp',
  instagram: 'instagram',
  call_log: 'call',
  note: 'note',
  system: 'note',
};

/** One entry as the chat column reads a message. */
function toChatMessage(row: z.output<typeof activityWire>): ChatMessage {
  return {
    id: row.id,
    channel: CHANNEL_OF[row.type],
    direction: row.direction ?? 'sent',
    body: row.body,
    // A call log, a note or a server entry is never delivered by a provider: it is just written.
    deliveryStatus: row.delivery_status ?? 'sent',
    isSystem: row.type === 'system',
    authorId: row.author_membership_id,
    taskId: row.task_id,
    sentAt: row.occurred_at,
  };
}

/** An entry with its group and record links — what the patient file's reads parse. */
const activityEntryWire = wireSchema<ApiActivity>()(
  activityWire.extend({
    group: z.enum(ACTIVITY_GROUPS),
    appointment_id: z.string().nullable(),
    invoice_id: z.string().nullable(),
    payment_id: z.string().nullable(),
    patient_prescription_id: z.string().nullable(),
    patient_offering_id: z.string().nullable(),
    patient_review_id: z.string().nullable(),
    patient_check_in_id: z.string().nullable(),
    patient_treatment_id: z.string().nullable(),
    patient_clinical_note_id: z.string().nullable(),
    patient_image_id: z.string().nullable(),
    patient_report_id: z.string().nullable(),
  }),
);

/** One entry as the patient file reads it: its first (only) record link named by kind. */
function toActivityEntry(row: z.output<typeof activityEntryWire>): ContactActivityEntry {
  const column = (Object.keys(ACTIVITY_LINKS) as (keyof typeof ACTIVITY_LINKS)[]).find(
    (key) => row[key] !== null,
  );
  const linked = column ? row[column] : null;
  return {
    id: row.id,
    type: row.type,
    group: row.group,
    body: row.body,
    occurredAt: row.occurred_at,
    authorId: row.author_membership_id,
    link: column && linked ? { kind: ACTIVITY_LINKS[column], id: linked } : null,
  };
}

/**
 * One page of a person's stream for a filter, newest first (`order=desc`); `after` is the
 * cursor. An entry linked to a record the member may not read is not in it (M10).
 */
export async function listContactActivities({
  contactId,
  filter,
  limit,
  after,
}: {
  contactId: string;
  filter: ContactActivityFilter;
  limit: number;
  after?: string;
}): Promise<ContactActivityPage> {
  const response = await api.get('/app/contacts/{contact_id}/activities', {
    params: { contact_id: contactId },
    query: { ...filterQuery(filter), order: 'desc', limit, after },
  });
  const pagination = response.meta?.pagination;
  return {
    rows: z
      .array(activityEntryWire)
      .parse(response.data ?? [])
      .map(toActivityEntry),
    next: pagination?.has_more ? (pagination.next ?? null) : null,
    hasMore: pagination?.has_more === true && Boolean(pagination.next),
    total: pagination?.estimated_total ?? null,
  };
}

/** The members the entries name, as the thread's sender lines show them. */
async function authorsOf(
  messages: readonly ChatMessage[],
): Promise<Record<string, ChatAuthor>> {
  const names = await fetchMemberNames(
    messages.flatMap((message) => message.authorId ?? []),
  );
  return Object.fromEntries(
    [...names].map(([id, name]) => [
      id,
      {
        id,
        name,
        initials: personInitials(name),
        tone: toneForLabel(name),
        roles: [],
        phone: null,
        email: null,
      },
    ]),
  );
}

/**
 * A contact's stream, every page, oldest first, with the members it names. A contact has no
 * thread record — the lead's details are the drawer's — so `thread` is `null`.
 */
export async function fetchContactThread(contactId: string): Promise<ChatThreadRead> {
  const rows = await collectAllPages(async (after) => {
    const response = await api.get('/app/contacts/{contact_id}/activities', {
      params: { contact_id: contactId },
      query: { limit: 100, after: after ?? undefined },
    });
    return {
      rows: z.array(activityWire).parse(response.data ?? []),
      next: response.meta?.pagination?.next ?? null,
    };
  }, 'contact-activities');
  const messages = rows.map(toChatMessage);
  return { thread: null, messages, authors: await authorsOf(messages) };
}

/**
 * Write one entry: a WhatsApp or Instagram message (`queued` until the messaging worker sends
 * it), a call the team made, or a team note.
 */
export async function sendContactActivity({
  contactId,
  channel,
  body,
  idempotencyKey,
}: {
  contactId: string;
  channel: ComposerMode;
  body: string;
  idempotencyKey: string;
}): Promise<ChatMessage> {
  const params = { contact_id: contactId };
  let data: unknown;
  if (channel === 'call') {
    ({ data } = await api.post('/app/contacts/{contact_id}/activities/log-call', {
      params,
      body: { direction: 'sent', body },
      idempotencyKey,
    }));
  } else if (channel === 'note') {
    ({ data } = await api.post('/app/contacts/{contact_id}/activities/add-note', {
      params,
      body: { body },
      idempotencyKey,
    }));
  } else {
    ({ data } = await api.post('/app/contacts/{contact_id}/activities/send-message', {
      params,
      body: { type: channel, body },
      idempotencyKey,
    }));
  }
  return toChatMessage(activityWire.parse(data));
}

/** Queue a failed message again (`409 transition_not_allowed` when it has not failed). */
export async function resendContactActivity({
  contactId,
  activityId,
  idempotencyKey,
}: {
  contactId: string;
  activityId: string;
  idempotencyKey: string;
}): Promise<ChatMessage> {
  const response = await api.post(
    '/app/contacts/{contact_id}/activities/{contact_activity_id}/resend',
    {
      params: { contact_id: contactId, contact_activity_id: activityId },
      idempotencyKey,
    },
  );
  return toChatMessage(activityWire.parse(response.data));
}

/**
 * Whether WhatsApp replies will wait in the queue: Meta is failing, or this deployment sends
 * nothing at all (`messaging-status`) — the composer's "WhatsApp down · replies will queue".
 */
export async function fetchContactMessagingStatus(): Promise<MessagingStatus> {
  const response: { data?: unknown } = await api.get(
    '/app/contact-activities/messaging-status',
  );
  const status = messagingStatusWire.parse(response.data);
  return { whatsappDown: status.is_provider_down || !status.is_delivery_enabled };
}

/**
 * What a contact's templates fill in: the clinic's name. The branch's address, maps and review
 * links are not on the branches a member reads (`/app/branches/my`), and the free slots need a
 * booking's length to ask `/app/appointments/slots` with — both stay empty (api-integration
 * §8, backend asks).
 */
export async function fetchContactTemplateValues(): Promise<ChatTemplateValues> {
  const organizationId = useOrganizationStore.getState().organizationId;
  const organizations = await ensureMyOrganizationSummaries();
  const organization = organizations.find((entry) => entry.id === organizationId);
  return {
    clinicName: organization?.name ?? '',
    address: '',
    mapsLink: '',
    reviewLink: '',
    freeSlots: [],
  };
}
