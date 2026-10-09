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
 * not channels (route map §4 #8).
 */

type ApiActivity = NonNullable<
  ApiData<'/app/contacts/{contact_id}/activities', 'get'>
>[number];

/** The stream's entry types. */
const ACTIVITY_TYPES = ['whatsapp', 'instagram', 'call_log', 'note', 'system'] as const;

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
