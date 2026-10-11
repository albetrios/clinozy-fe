import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('./directory-api.ts', () => ({ fetchMemberNames: vi.fn() }));
vi.mock('@/shared/tenancy/my-organization-summaries.ts', () => ({
  ensureMyOrganizationSummaries: vi.fn(),
}));
import { api } from '@/core/http/api.ts';
import { toneForLabel } from '@/shared/app/app-tones.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import type { OrganizationSummary } from '@/shared/tenancy/me-context.ts';
import { ensureMyOrganizationSummaries } from '@/shared/tenancy/my-organization-summaries.ts';

import {
  contactActivityQueryKeys,
  fetchContactMessagingStatus,
  fetchContactTemplateValues,
  fetchContactThread,
  listContactActivities,
  resendContactActivity,
  sendContactActivity,
} from './contact-activities-api.ts';
import { fetchMemberNames } from './directory-api.ts';

const CONTACT_ID = 'con_anaya0000000000000000';
const RIYA = 'mem_riya00000000000000000';
const NIDHI = 'mem_nidhi0000000000000000';

/** One entry of a contact's stream as clinozy-be answers it. */
const activity = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  type: 'whatsapp',
  direction: 'received',
  body: 'Hi, is the peel available?',
  delivery_status: 'delivered',
  occurred_at: '2026-10-03T04:00:00.000Z',
  author_membership_id: null,
  task_id: null,
  ...patch,
});

/** One page of the stream; `next` is the following page's cursor. */
const page = (rows: unknown[], next: string | null = null) => ({
  data: rows,
  meta: {
    request_id: 'req',
    pagination: { per_page: 100, next, has_more: next !== null },
  },
});

/** An organization the member belongs to. */
const organization = (id: string, name: string): OrganizationSummary => ({
  id,
  name,
  slug: name.toLowerCase().replaceAll(' ', '-'),
  type: 'TEAM',
  status: 'ACTIVE',
  logoUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

/** The messaging status as clinozy-be answers it. */
const messagingStatus = (patch: Record<string, unknown> = {}) => ({
  data: {
    is_delivery_enabled: true,
    is_provider_down: false,
    whatsapp: { is_connected: true, queued_count: 0 },
    instagram: { is_connected: true, queued_count: 0 },
    ...patch,
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchMemberNames).mockResolvedValue(
    new Map([
      [RIYA, 'Riya Shah'],
      [NIDHI, 'Nidhi Kapoor'],
    ]),
  );
});
afterEach(() => {
  useOrganizationStore.getState().clearOrganization();
});

describe('fetchContactThread', () => {
  it('reads every page of the stream, oldest first, as the chat column’s messages', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(page([activity('act_first')], 'cursor-2') as never)
      .mockResolvedValueOnce(
        page([
          activity('act_second', {
            direction: 'sent',
            body: 'Yes — Saturday at 11?',
            delivery_status: 'read',
            author_membership_id: RIYA,
          }),
        ]) as never,
      );

    const read = await fetchContactThread(CONTACT_ID);

    expect(api.get).toHaveBeenNthCalledWith(1, '/app/contacts/{contact_id}/activities', {
      params: { contact_id: CONTACT_ID },
      query: { limit: 100, after: undefined },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/app/contacts/{contact_id}/activities', {
      params: { contact_id: CONTACT_ID },
      query: { limit: 100, after: 'cursor-2' },
    });
    expect(read.thread).toBeNull();
    expect(read.messages).toEqual([
      {
        id: 'act_first',
        channel: 'whatsapp',
        direction: 'received',
        body: 'Hi, is the peel available?',
        deliveryStatus: 'delivered',
        isSystem: false,
        authorId: null,
        taskId: null,
        sentAt: '2026-10-03T04:00:00.000Z',
      },
      {
        id: 'act_second',
        channel: 'whatsapp',
        direction: 'sent',
        body: 'Yes — Saturday at 11?',
        deliveryStatus: 'read',
        isSystem: false,
        authorId: RIYA,
        taskId: null,
        sentAt: '2026-10-03T04:00:00.000Z',
      },
    ]);
  });

  it('reads each entry type as its channel, and the server’s entries as system lines', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([
        activity('act_instagram', { type: 'instagram' }),
        activity('act_call', {
          type: 'call_log',
          direction: 'sent',
          delivery_status: null,
          task_id: 'task_call00000000000000000',
        }),
        activity('act_note', { type: 'note', direction: null, delivery_status: null }),
        activity('act_system', {
          type: 'system',
          direction: null,
          delivery_status: null,
          body: 'Status → Contacted',
        }),
      ]) as never,
    );

    const { messages } = await fetchContactThread(CONTACT_ID);

    expect(
      messages.map(({ id, channel, direction, deliveryStatus, isSystem, taskId }) => ({
        id,
        channel,
        direction,
        deliveryStatus,
        isSystem,
        taskId,
      })),
    ).toEqual([
      {
        id: 'act_instagram',
        channel: 'instagram',
        direction: 'received',
        deliveryStatus: 'delivered',
        isSystem: false,
        taskId: null,
      },
      {
        id: 'act_call',
        channel: 'call',
        direction: 'sent',
        deliveryStatus: 'sent',
        isSystem: false,
        taskId: 'task_call00000000000000000',
      },
      {
        id: 'act_note',
        channel: 'note',
        direction: 'sent',
        deliveryStatus: 'sent',
        isSystem: false,
        taskId: null,
      },
      {
        id: 'act_system',
        channel: 'note',
        direction: 'sent',
        deliveryStatus: 'sent',
        isSystem: true,
        taskId: null,
      },
    ]);
  });

  it('names the members the entries point at, from one names read', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([
        activity('act_first', { author_membership_id: RIYA }),
        activity('act_second', { author_membership_id: NIDHI }),
        activity('act_third', { author_membership_id: RIYA }),
        activity('act_fourth'),
      ]) as never,
    );

    const { authors } = await fetchContactThread(CONTACT_ID);

    expect(fetchMemberNames).toHaveBeenCalledTimes(1);
    expect(fetchMemberNames).toHaveBeenCalledWith([RIYA, NIDHI, RIYA]);
    expect(authors).toEqual({
      [RIYA]: {
        id: RIYA,
        name: 'Riya Shah',
        initials: 'RS',
        tone: toneForLabel('Riya Shah'),
        roles: [],
        phone: null,
        email: null,
      },
      [NIDHI]: {
        id: NIDHI,
        name: 'Nidhi Kapoor',
        initials: 'NK',
        tone: toneForLabel('Nidhi Kapoor'),
        roles: [],
        phone: null,
        email: null,
      },
    });
  });

  it('reads a person with no stream yet as an empty thread', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: undefined } as never);
    vi.mocked(fetchMemberNames).mockResolvedValueOnce(new Map());
    expect(await fetchContactThread(CONTACT_ID)).toEqual({
      thread: null,
      messages: [],
      authors: {},
    });
  });
});

describe('sendContactActivity', () => {
  it.each(['whatsapp', 'instagram'] as const)(
    'sends a %s message through send-message, with its type and the key',
    async (channel) => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: activity('act_sent', {
          type: channel,
          direction: 'sent',
          delivery_status: 'queued',
          body: 'See you Saturday',
          author_membership_id: RIYA,
        }),
      } as never);

      const sent = await sendContactActivity({
        contactId: CONTACT_ID,
        channel,
        body: 'See you Saturday',
        idempotencyKey: 'key-send',
      });

      expect(api.post).toHaveBeenCalledWith(
        '/app/contacts/{contact_id}/activities/send-message',
        {
          params: { contact_id: CONTACT_ID },
          body: { type: channel, body: 'See you Saturday' },
          idempotencyKey: 'key-send',
        },
      );
      expect(sent).toMatchObject({
        id: 'act_sent',
        channel,
        direction: 'sent',
        deliveryStatus: 'queued',
        authorId: RIYA,
      });
    },
  );

  it('logs a call the team made through log-call', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: activity('act_call', {
        type: 'call_log',
        direction: 'sent',
        delivery_status: null,
        body: 'No answer',
      }),
    } as never);

    const sent = await sendContactActivity({
      contactId: CONTACT_ID,
      channel: 'call',
      body: 'No answer',
      idempotencyKey: 'key-call',
    });

    expect(api.post).toHaveBeenCalledWith(
      '/app/contacts/{contact_id}/activities/log-call',
      {
        params: { contact_id: CONTACT_ID },
        body: { direction: 'sent', body: 'No answer' },
        idempotencyKey: 'key-call',
      },
    );
    expect(sent).toMatchObject({ channel: 'call', deliveryStatus: 'sent' });
  });

  it('writes a team note through add-note', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: activity('act_note', {
        type: 'note',
        direction: null,
        delivery_status: null,
        body: 'Prefers mornings',
      }),
    } as never);

    const sent = await sendContactActivity({
      contactId: CONTACT_ID,
      channel: 'note',
      body: 'Prefers mornings',
      idempotencyKey: 'key-note',
    });

    expect(api.post).toHaveBeenCalledWith(
      '/app/contacts/{contact_id}/activities/add-note',
      {
        params: { contact_id: CONTACT_ID },
        body: { body: 'Prefers mornings' },
        idempotencyKey: 'key-note',
      },
    );
    expect(sent).toMatchObject({ channel: 'note', direction: 'sent', isSystem: false });
  });
});

describe('resendContactActivity', () => {
  it('queues a failed message again with the key', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: activity('act_failed', { direction: 'sent', delivery_status: 'queued' }),
    } as never);

    const queued = await resendContactActivity({
      contactId: CONTACT_ID,
      activityId: 'act_failed',
      idempotencyKey: 'key-resend',
    });

    expect(api.post).toHaveBeenCalledWith(
      '/app/contacts/{contact_id}/activities/{contact_activity_id}/resend',
      {
        params: { contact_id: CONTACT_ID, contact_activity_id: 'act_failed' },
        idempotencyKey: 'key-resend',
      },
    );
    expect(queued).toMatchObject({ id: 'act_failed', deliveryStatus: 'queued' });
  });
});

describe('fetchContactMessagingStatus', () => {
  it('reads WhatsApp as up while messages go out', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(messagingStatus() as never);
    expect(await fetchContactMessagingStatus()).toEqual({ whatsappDown: false });
    expect(api.get).toHaveBeenCalledWith('/app/contact-activities/messaging-status');
  });

  it('reads WhatsApp as down when the provider is failing', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      messagingStatus({ is_provider_down: true }) as never,
    );
    expect(await fetchContactMessagingStatus()).toEqual({ whatsappDown: true });
  });

  it('reads WhatsApp as down when this deployment sends nothing', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      messagingStatus({ is_delivery_enabled: false }) as never,
    );
    expect(await fetchContactMessagingStatus()).toEqual({ whatsappDown: true });
  });
});

describe('fetchContactTemplateValues', () => {
  it('fills in the active organization’s name, and leaves the rest empty', async () => {
    useOrganizationStore.getState().setOrganization('org_cresence', 'cresence');
    vi.mocked(ensureMyOrganizationSummaries).mockResolvedValueOnce([
      organization('org_other', 'Other Clinic'),
      organization('org_cresence', 'Cresence Skin'),
    ]);

    expect(await fetchContactTemplateValues()).toEqual({
      clinicName: 'Cresence Skin',
      address: '',
      mapsLink: '',
      reviewLink: '',
      freeSlots: [],
    });
  });

  it('leaves the name empty when the organization is not among the member’s', async () => {
    useOrganizationStore.getState().setOrganization('org_gone', 'gone');
    vi.mocked(ensureMyOrganizationSummaries).mockResolvedValueOnce([
      organization('org_other', 'Other Clinic'),
    ]);
    expect((await fetchContactTemplateValues()).clinicName).toBe('');
  });
});

/** A record link column of an entry, none set — `patch` sets the one it is about. */
const NO_LINKS = {
  appointment_id: null,
  invoice_id: null,
  payment_id: null,
  patient_prescription_id: null,
  patient_offering_id: null,
  patient_review_id: null,
  patient_check_in_id: null,
  patient_treatment_id: null,
  patient_clinical_note_id: null,
  patient_image_id: null,
  patient_report_id: null,
};

/** A server event of the stream, as clinozy-be answers it (the live shape, 2026-10-10). */
const event = (id: string, patch: Record<string, unknown> = {}) =>
  activity(id, {
    type: 'system',
    direction: null,
    delivery_status: null,
    body: 'Treatment recorded: Back Peeling',
    group: 'clinical',
    ...NO_LINKS,
    ...patch,
  });

describe('listContactActivities (§6 #2, #3)', () => {
  it('reads one page of a filter, newest first, as the file’s entries with their record link', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        event('msg_treat', { patient_treatment_id: 'trt_peel' }),
        event('msg_bill', {
          body: 'Invoice 2026-27/0001 billed: ₹3,540.00',
          group: 'money',
          invoice_id: 'invc_one',
        }),
        event('msg_note', {
          type: 'note',
          group: 'messages',
          body: 'Call before the next session',
          author_membership_id: RIYA,
        }),
      ],
      meta: {
        request_id: 'req',
        pagination: {
          per_page: 20,
          next: 'cursor-2',
          has_more: true,
          estimated_total: 8,
        },
      },
    } as never);

    const page = await listContactActivities({
      contactId: CONTACT_ID,
      filter: { type: ['system', 'note'], group: ['clinical', 'messages'] },
      limit: 20,
    });

    expect(api.get).toHaveBeenCalledWith('/app/contacts/{contact_id}/activities', {
      params: { contact_id: CONTACT_ID },
      query: {
        type: 'system,note',
        group: 'clinical,messages',
        order: 'desc',
        limit: 20,
        after: undefined,
      },
    });
    expect(page).toEqual({
      rows: [
        {
          id: 'msg_treat',
          type: 'system',
          group: 'clinical',
          body: 'Treatment recorded: Back Peeling',
          occurredAt: '2026-10-03T04:00:00.000Z',
          authorId: null,
          link: { kind: 'treatment', id: 'trt_peel' },
        },
        {
          id: 'msg_bill',
          type: 'system',
          group: 'money',
          body: 'Invoice 2026-27/0001 billed: ₹3,540.00',
          occurredAt: '2026-10-03T04:00:00.000Z',
          authorId: null,
          link: { kind: 'invoice', id: 'invc_one' },
        },
        {
          id: 'msg_note',
          type: 'note',
          group: 'messages',
          body: 'Call before the next session',
          occurredAt: '2026-10-03T04:00:00.000Z',
          authorId: RIYA,
          link: null,
        },
      ],
      next: 'cursor-2',
      hasMore: true,
      total: 8,
    });
  });

  it('reads the page after a cursor, with no filter left in the query', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([]) as never);
    const read = await listContactActivities({
      contactId: CONTACT_ID,
      filter: {},
      limit: 3,
      after: 'cursor-2',
    });
    expect(api.get).toHaveBeenCalledWith('/app/contacts/{contact_id}/activities', {
      params: { contact_id: CONTACT_ID },
      query: { order: 'desc', limit: 3, after: 'cursor-2' },
    });
    expect(read).toEqual({ rows: [], next: null, hasMore: false, total: null });
  });

  it('keys each filter and page size apart, under the person’s stream and the thread’s key', () => {
    const notes = contactActivityQueryKeys.list(
      'org_a',
      CONTACT_ID,
      { type: ['note'] },
      3,
    );
    expect(notes.slice(0, 2)).toEqual(['app', 'messages']);
    expect(notes).toEqual([
      ...contactActivityQueryKeys.contact('org_a', CONTACT_ID),
      'list',
      { type: 'note' },
      3,
    ]);
    expect(
      contactActivityQueryKeys.list('org_a', CONTACT_ID, { type: ['note'] }),
    ).toEqual(notes.slice(0, -1));
  });
});
