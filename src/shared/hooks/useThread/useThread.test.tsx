import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import * as messagesApi from '@/shared/api/clinic/messages-api.ts';
import {
  type ChatPerson,
  chatPersonKey,
} from '@/shared/api/clinic/messages-contracts.ts';
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

vi.mock('@/shared/api/clinic/messages-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof messagesApi>();
  return { ...actual, sendMessage: vi.fn(actual.sendMessage) };
});
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const ANAYA: ChatPerson = { kind: 'lead', leadId: ref.lead(2363) };
const KABIR: ChatPerson = { kind: 'lead', leadId: ref.lead(2364) };
const KIRAN: ChatPerson = { kind: 'patient', patientId: patientRef('Kiran Desai') };

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
function renderChat(person: ChatPerson) {
  const recipient = RECIPIENTS[chatPersonKey(person)] ?? { name: 'Someone', phone: null };
  return renderHook(
    () => {
      const { data, isSuccess, isFetching } = useThread(person);
      return {
        thread: { data, isSuccess, isFetching },
        outbox: useThreadOutbox(person),
        chat: useSendMessage(person, recipient),
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
  resetClinicFixtures();
  resetOutboxes();
});
afterEach(() => {
  // Unmount before the stores reset, so no hook re-renders on the way out.
  cleanup();
  vi.useRealTimers();
  vi.mocked(messagesApi.sendMessage).mockClear();
  client.clear();
  resetClinicFixtures();
  resetOutboxes();
});

describe('the reads', () => {
  it('reads the thread, the history, the status and the template values', async () => {
    const { result } = renderHook(
      () => ({
        thread: useThread(ANAYA),
        history: useContactHistory({ kind: 'lead', leadId: ref.lead(2352) }),
        status: useMessagingStatus(),
        values: useTemplateValues(ANAYA),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.values.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.history.isSuccess).toBe(true));
    expect(result.current.thread.data?.messages).toHaveLength(3);
    expect(result.current.history.data?.at(-1)).toMatchObject({ kind: 'appointment' });
    expect(result.current.status.data).toEqual({ whatsappDown: false });
    expect(result.current.values.data?.clinicName).toBe('Cresence Skin');
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
    const threads = clinicFixtures.leads.snapshot((lead) => lead.name === 'Kiran Desai');
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
