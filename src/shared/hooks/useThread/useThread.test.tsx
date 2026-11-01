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
import type { ChatMessage, ChatPerson } from '@/shared/api/app/messages-contracts.ts';
import { notify } from '@/shared/notify/index.ts';

import { resetOutboxes } from './thread-outbox.ts';
import {
  useMessagingStatus,
  useResendMessage,
  useSendMessage,
  useTemplateValues,
  useThread,
  useThreadOutbox,
} from './useThread.ts';

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

/** A person on clinozy-be: their stream is `/app/contacts/:contact_id/activities`. */
const CONTACT_ID = 'con_anaya0000000000000000';
const CONTACT: ChatPerson = { kind: 'contact', contactId: CONTACT_ID };
/** A second contact, for what a person keeps while the column shows someone else. */
const OTHER: ChatPerson = { kind: 'contact', contactId: 'con_kabir0000000000000000' };

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

/**
 * The thread, its outbox and the send hook of one person, sharing one cache.
 * The thread's fields are read during render, as a component would: TanStack
 * re-renders only for the fields a render read.
 */
function renderChat(person: ChatPerson, onSent?: () => void) {
  return renderHook(
    () => {
      const { data, isSuccess, isFetching } = useThread(person);
      return {
        thread: { data, isSuccess, isFetching },
        outbox: useThreadOutbox(person),
        chat: useSendMessage(person, { onSent }),
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
  vi.mocked(fetchContactThread).mockReset();
  vi.mocked(sendContactActivity).mockReset();
  vi.mocked(resendContactActivity).mockReset();
  vi.mocked(fetchContactMessagingStatus).mockReset();
  vi.mocked(fetchContactTemplateValues).mockReset();
  client.clear();
  resetOutboxes();
});

describe('the reads', () => {
  it('reads a contact’s stream, status and template values from clinozy-be', async () => {
    const { result } = renderHook(
      () => ({
        thread: useThread(CONTACT),
        status: useMessagingStatus(),
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
  });
});

describe('sending', () => {
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
    await waitFor(() =>
      expect(result.current.thread.data?.messages.map((message) => message.body)).toEqual(
        ['Is the peel available?', 'No answer'],
      ),
    );
  });

  it('sends nothing for blank text', async () => {
    const { result } = renderChat(CONTACT);
    act(() => result.current.chat.send('whatsapp', '   '));
    expect(result.current.outbox).toEqual([]);
    expect(sendContactActivity).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.thread.isSuccess).toBe(true));
  });

  it('marks a failed send "Not sent" without a toast, and a retry sends it', async () => {
    vi.mocked(sendContactActivity).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderChat(CONTACT);
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
    expect(sendContactActivity).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(result.current.thread.data?.messages.at(-1)?.body).toBe('Calling at 11'),
    );
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

  it('keeps a person’s unsent message while the column shows someone else', async () => {
    vi.mocked(sendContactActivity).mockRejectedValueOnce(new Error('offline'));
    const first = renderChat(CONTACT);
    await waitFor(() => expect(first.result.current.thread.isSuccess).toBe(true));
    act(() => first.result.current.chat.send('instagram', 'Still there?'));
    await waitFor(() => expect(first.result.current.outbox[0]?.state).toBe('failed'));
    first.unmount();

    const other = renderChat(OTHER);
    await waitFor(() => expect(other.result.current.thread.isSuccess).toBe(true));
    expect(other.result.current.outbox).toEqual([]);
    other.unmount();
    const back = renderChat(CONTACT);
    expect(back.result.current.outbox).toEqual([
      expect.objectContaining({ body: 'Still there?', state: 'failed' }),
    ]);
    // Its stale copy refetches on mount; let that land inside the test.
    await waitFor(() => expect(back.result.current.thread.isFetching).toBe(false));
  });
});

describe('resending a stored failed message', () => {
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

describe('the edges of a send', () => {
  it('sends again only a message that is "Not sent" — one still sending, or unknown, is left alone', async () => {
    let finish: ((message: ChatMessage) => void) | undefined;
    vi.mocked(sendContactActivity).mockImplementationOnce(
      () =>
        new Promise<ChatMessage>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderChat(CONTACT);
    await waitFor(() => expect(result.current.thread.isSuccess).toBe(true));

    act(() => result.current.chat.send('whatsapp', 'On my way'));
    const clientId = result.current.outbox[0]?.clientId ?? '';
    expect(result.current.outbox[0]?.state).toBe('sending');
    await waitFor(() => expect(sendContactActivity).toHaveBeenCalledOnce());

    act(() => result.current.chat.retry(clientId));
    act(() => result.current.chat.retry('no-such-message'));
    await act(async () => Promise.resolve());
    expect(sendContactActivity).toHaveBeenCalledOnce();
    expect(result.current.outbox[0]?.state).toBe('sending');

    finish?.(streamEntry('msg_on_my_way', { direction: 'sent', body: 'On my way' }));
    await waitFor(() => expect(result.current.outbox).toEqual([]));
  });
});
