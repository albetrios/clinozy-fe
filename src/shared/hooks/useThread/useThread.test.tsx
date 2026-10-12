import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ContactActivitiesApiModule from '@/shared/api/app/contact-activities-api.ts';
import {
  fetchContactMessagingStatus,
  fetchContactTemplateValues,
  fetchContactThread,
  resendContactActivity,
  sendContactActivity,
} from '@/shared/api/app/contact-activities-api.ts';
import { patientRef } from '@/shared/api/app/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import {
  appFixtures,
  resetAppFixtures,
} from '@/shared/api/app/fixtures/world.fixtures.ts';
import * as messagesApi from '@/shared/api/app/messages-api.ts';
import {
  type ChatMessage,
  type ChatPerson,
  chatPersonKey,
} from '@/shared/api/app/messages-contracts.ts';
import { notify } from '@/shared/notify/index.ts';

import { resetOutboxes } from './thread-outbox.ts';
import {
  type ChatRecipient,
  useContactHistory,
  useMessagingStatus,
  useResendMessage,
  useSendMessage,
  useTemplateValues,
  useThread,
  useThreadOutbox,
} from './useThread.ts';

vi.mock('@/shared/api/app/messages-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof messagesApi>();
  return { ...actual, sendMessage: vi.fn(actual.sendMessage) };
});
vi.mock('@/shared/api/app/contact-activities-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof ContactActivitiesApiModule>()),
  fetchContactThread: vi.fn(),
  sendContactActivity: vi.fn(),
  resendContactActivity: vi.fn(),
  fetchContactMessagingStatus: vi.fn(),
  fetchContactTemplateValues: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const ANAYA: ChatPerson = { kind: 'lead', leadId: ref.lead(2363) };
const KABIR: ChatPerson = { kind: 'lead', leadId: ref.lead(2364) };
const KIRAN: ChatPerson = { kind: 'patient', patientId: patientRef('Kiran Desai') };
/** A person on clinozy-be: their stream is `/app/contacts/:contact_id/activities`. */
const CONTACT_ID = 'con_anaya0000000000000000';
const CONTACT: ChatPerson = { kind: 'contact', contactId: CONTACT_ID };

/** One entry of a contact's stream, as the chat column reads it. */
const streamEntry = (id: string, patch: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  channel: 'whatsapp',
  direction: 'received',
  body: 'Is the peel available?',
  deliveryStatus: 'delivered',
  isSystem: false,
  authorId: null,
  taskId: null,
  sentAt: '2026-10-03T04:00:00.000Z',
  ...patch,
});

/** The contact's stream on the mocked clinozy-be. */
let stream: ChatMessage[] = [];

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Who a first message goes to — the column passes its contact. */
const RECIPIENTS: Record<string, ChatRecipient> = {
  [chatPersonKey(ANAYA)]: { name: 'Anaya Desai', phone: '+919879521034' },
  [chatPersonKey(KABIR)]: { name: 'Kabir Mehta', phone: '+919925044710' },
  [chatPersonKey(KIRAN)]: { name: 'Kiran Desai', phone: null },
};

/**
 * The thread, its outbox and the send hook of one person, sharing one cache.
 * The thread's fields are read during render, as a component would: TanStack
 * re-renders only for the fields a render read.
 */
function renderChat(person: ChatPerson, onSent?: () => void) {
  const recipient = RECIPIENTS[chatPersonKey(person)] ?? { name: 'Someone', phone: null };
  return renderHook(
    () => {
      const { data, isSuccess, isFetching } = useThread(person);
      return {
        thread: { data, isSuccess, isFetching },
        outbox: useThreadOutbox(person),
        chat: useSendMessage(person, recipient, { onSent }),
      };
    },
    { wrapper },
  );
}

beforeEach(() => {
  // 15:00 in the clinic (IST): after every seeded message of the day, whenever the suite runs.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T09:30:00Z'));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(notify.error).mockClear();
  resetAppFixtures();
  resetOutboxes();
  stream = [streamEntry('act_first')];
  vi.mocked(fetchContactThread).mockImplementation(async () => ({
    thread: null,
    messages: [...stream],
    authors: {},
  }));
  vi.mocked(sendContactActivity).mockImplementation(async ({ channel, body }) => {
    const sent = streamEntry(`act_sent_${stream.length}`, {
      channel,
      direction: 'sent',
      body,
      deliveryStatus: 'queued',
    });
    stream = [...stream, sent];
    return sent;
  });
  vi.mocked(resendContactActivity).mockImplementation(async ({ activityId }) => {
    stream = stream.map((entry) =>
      entry.id === activityId ? { ...entry, deliveryStatus: 'queued' } : entry,
    );
    const queued = stream.find((entry) => entry.id === activityId);
    if (!queued) throw new Error(`no activity ${activityId}`);
    return queued;
  });
  vi.mocked(fetchContactMessagingStatus).mockResolvedValue({
    whatsappDown: false,
    isConnected: false,
  });
  vi.mocked(fetchContactTemplateValues).mockResolvedValue({
    clinicName: 'Cresence Skin Clinic',
    address: '',
    mapsLink: '',
    reviewLink: '',
    freeSlots: [],
  });
});
afterEach(() => {
  // Unmount before the stores reset, so no hook re-renders on the way out.
  cleanup();
  vi.useRealTimers();
  vi.mocked(messagesApi.sendMessage).mockClear();
  vi.mocked(fetchContactThread).mockReset();
  vi.mocked(sendContactActivity).mockReset();
  vi.mocked(resendContactActivity).mockReset();
  vi.mocked(fetchContactMessagingStatus).mockReset();
  vi.mocked(fetchContactTemplateValues).mockReset();
  client.clear();
  resetAppFixtures();
  resetOutboxes();
});

describe('the reads', () => {
  it('reads the thread, the history, the status and the template values', async () => {
    const { result } = renderHook(
      () => ({
        thread: useThread(ANAYA),
        history: useContactHistory({ kind: 'lead', leadId: ref.lead(2352) }),
        status: useMessagingStatus(ANAYA),
        values: useTemplateValues(ANAYA),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.values.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.history.isSuccess).toBe(true));
    expect(result.current.thread.data?.messages).toHaveLength(3);
    expect(result.current.history.data?.at(-1)).toMatchObject({ kind: 'appointment' });
    expect(result.current.status.data).toEqual({
      whatsappDown: false,
      isConnected: true,
    });
    expect(result.current.values.data?.clinicName).toBe('Cresence Skin');
    expect(fetchContactThread).not.toHaveBeenCalled();
    expect(fetchContactMessagingStatus).not.toHaveBeenCalled();
  });

  it('reads a contact’s stream, status and template values from clinozy-be — with no history of its own', async () => {
    const { result } = renderHook(
      () => ({
        thread: useThread(CONTACT),
        history: useContactHistory(CONTACT),
        status: useMessagingStatus(CONTACT),
        values: useTemplateValues(CONTACT),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.thread.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.status.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.values.isSuccess).toBe(true));

    expect(fetchContactThread).toHaveBeenCalledWith(CONTACT_ID);
    expect(result.current.thread.data).toEqual({
      thread: null,
      messages: [streamEntry('act_first')],
      authors: {},
    });
    expect(result.current.status.data).toEqual({
      whatsappDown: false,
      isConnected: false,
    });
    expect(result.current.values.data?.clinicName).toBe('Cresence Skin Clinic');
    expect(result.current.history.fetchStatus).toBe('idle');
  });
});

describe('sending', () => {
  it('shows the message as sending at once, then moves it into the thread', async () => {
    const { result } = renderChat(ANAYA);
    await waitFor(() => expect(result.current.thread.isSuccess).toBe(true));

    act(() => result.current.chat.send('whatsapp', '  Hi Anaya  '));
    expect(result.current.outbox).toEqual([
      expect.objectContaining({
        body: 'Hi Anaya',
        channel: 'whatsapp',
        state: 'sending',
      }),
    ]);

    await waitFor(() => expect(result.current.outbox).toEqual([]));
    const bodies = result.current.thread.data?.messages.map((message) => message.body);
    expect(bodies).toContain('Hi Anaya');
    await waitFor(() =>
      expect(result.current.thread.data?.messages.at(-1)?.body).toBe(
        'Status → Contacted (first reply)',
      ),
    );
  });

  it('sends nothing for blank text', async () => {
    const { result } = renderChat(ANAYA);
    act(() => result.current.chat.send('whatsapp', '   '));
    expect(result.current.outbox).toEqual([]);
    expect(messagesApi.sendMessage).not.toHaveBeenCalled();
  });

  it('marks a failed send "Not sent" without a toast, and a retry sends it', async () => {
    vi.mocked(messagesApi.sendMessage).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderChat(KABIR);
    await waitFor(() => expect(result.current.thread.isSuccess).toBe(true));

    act(() => result.current.chat.send('instagram', 'Calling at 11'));
    await waitFor(() =>
      expect(result.current.outbox).toEqual([
        expect.objectContaining({ body: 'Calling at 11', state: 'failed' }),
      ]),
    );
    expect(notify.error).not.toHaveBeenCalled();

    const clientId = result.current.outbox[0]?.clientId ?? '';
    act(() => result.current.chat.retry(clientId));
    expect(result.current.outbox[0]?.state).toBe('sending');
    await waitFor(() => expect(result.current.outbox).toEqual([]));
    expect(messagesApi.sendMessage).toHaveBeenCalledTimes(2);
    expect(result.current.thread.data?.messages.at(-1)?.body).toBe('Calling at 11');
  });

  it('opens a patient’s contact thread with their first message', async () => {
    const { result } = renderChat(KIRAN);
    await waitFor(() => expect(result.current.thread.data?.thread).toBeNull());

    act(() => result.current.chat.send('whatsapp', 'Hello Kiran'));
    await waitFor(() =>
      expect(result.current.thread.data?.thread?.kind).toBe('contact_thread'),
    );
    expect(result.current.thread.data?.messages.map((message) => message.body)).toEqual([
      'Hello Kiran',
    ]);
    const threads = appFixtures.leads.snapshot((lead) => lead.name === 'Kiran Desai');
    expect(threads).toHaveLength(1);
  });

  it('keeps a person’s unsent message while the column shows someone else', async () => {
    vi.mocked(messagesApi.sendMessage).mockRejectedValueOnce(new Error('offline'));
    const first = renderChat(KABIR);
    await waitFor(() => expect(first.result.current.thread.isSuccess).toBe(true));
    act(() => first.result.current.chat.send('instagram', 'Still there?'));
    await waitFor(() => expect(first.result.current.outbox[0]?.state).toBe('failed'));
    first.unmount();

    const other = renderChat(ANAYA);
    await waitFor(() => expect(other.result.current.thread.isSuccess).toBe(true));
    other.unmount();
    const back = renderChat(KABIR);
    expect(back.result.current.outbox).toEqual([
      expect.objectContaining({ body: 'Still there?', state: 'failed' }),
    ]);
    // Its stale copy refetches on mount; let that land inside the test.
    await waitFor(() => expect(back.result.current.thread.isFetching).toBe(false));
  });
});

describe('a contact’s stream', () => {
  it('sends through clinozy-be with the action’s key and moves the message into the thread', async () => {
    const { result } = renderChat(CONTACT);
    await waitFor(() => expect(result.current.thread.isSuccess).toBe(true));

    act(() => result.current.chat.send('call', '  No answer  '));
    expect(result.current.outbox).toEqual([
      expect.objectContaining({ body: 'No answer', channel: 'call', state: 'sending' }),
    ]);

    await waitFor(() => expect(result.current.outbox).toEqual([]));
    expect(sendContactActivity).toHaveBeenCalledWith({
      contactId: CONTACT_ID,
      channel: 'call',
      body: 'No answer',
      idempotencyKey: expect.any(String),
    });
    expect(messagesApi.sendMessage).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(result.current.thread.data?.messages.map((message) => message.body)).toEqual(
        ['Is the peel available?', 'No answer'],
      ),
    );
  });

  it('marks a failed send "Not sent" without a toast', async () => {
    vi.mocked(sendContactActivity).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderChat(CONTACT);
    await waitFor(() => expect(result.current.thread.isSuccess).toBe(true));

    act(() => result.current.chat.send('whatsapp', 'Hello'));

    await waitFor(() =>
      expect(result.current.outbox).toEqual([
        expect.objectContaining({ body: 'Hello', state: 'failed' }),
      ]),
    );
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('tells the host once the server took a message — never for a failed send (D81 T7)', async () => {
    const onSent = vi.fn();
    vi.mocked(sendContactActivity).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderChat(CONTACT, onSent);
    await waitFor(() => expect(result.current.thread.isSuccess).toBe(true));

    act(() => result.current.chat.send('whatsapp', 'Hello'));
    await waitFor(() =>
      expect(result.current.outbox).toEqual([
        expect.objectContaining({ body: 'Hello', state: 'failed' }),
      ]),
    );
    expect(onSent).not.toHaveBeenCalled();

    act(() => result.current.chat.send('call', 'Called back'));
    await waitFor(() => expect(onSent).toHaveBeenCalledOnce());
  });

  it('resends a failed entry through clinozy-be and refetches the stream', async () => {
    stream = [streamEntry('act_failed', { direction: 'sent', deliveryStatus: 'failed' })];
    const { result } = renderHook(
      () => {
        const { data, isSuccess } = useThread(CONTACT);
        return { thread: { data, isSuccess }, resend: useResendMessage(CONTACT) };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.thread.isSuccess).toBe(true));

    await act(() => result.current.resend.mutateAsync('act_failed'));

    expect(resendContactActivity).toHaveBeenCalledWith({
      contactId: CONTACT_ID,
      activityId: 'act_failed',
      idempotencyKey: expect.any(String),
    });
    await waitFor(() =>
      expect(result.current.thread.data?.messages[0]?.deliveryStatus).toBe('queued'),
    );
  });
});

describe('resending a stored failed message', () => {
  it('queues it again and refetches the thread', async () => {
    const { result } = renderHook(
      () => {
        const { data, isSuccess } = useThread(KABIR);
        return { thread: { data, isSuccess }, resend: useResendMessage(KABIR) };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.thread.isSuccess).toBe(true));
    const failed = result.current.thread.data?.messages.find(
      (message) => message.deliveryStatus === 'failed',
    );
    expect(failed).toBeDefined();

    await act(() => result.current.resend.mutateAsync(failed?.id ?? ''));
    await waitFor(() =>
      expect(
        result.current.thread.data?.messages.find((message) => message.id === failed?.id)
          ?.deliveryStatus,
      ).toBe('sent'),
    );
  });
});
