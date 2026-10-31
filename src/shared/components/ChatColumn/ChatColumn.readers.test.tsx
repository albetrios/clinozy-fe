import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import * as contactActivitiesApi from '@/shared/api/app/contact-activities-api.ts';
import type { ChatMessage, ChatPerson } from '@/shared/api/app/messages-contracts.ts';
import { resetOutboxes } from '@/shared/hooks/useThread/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import { CHAT_COLUMN_TEST_IDS as ids } from './chat-column.constants.ts';
import type { ChatContact } from './chat-composer.ts';
import { clearDrafts } from './chat-drafts.ts';
import { ChatColumn, type ChatColumnProps } from './ChatColumn.tsx';

/*
 * What the chat column reads: a contact's stream on clinozy-be (`contact-activities-api.ts` —
 * no messaging service yet, so every message waits queued), and the edges around it: a thread
 * that cannot be read, a status that cannot be read, a header with no mobile or with the host's
 * contact card.
 */

vi.mock('@/shared/api/app/contact-activities-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof contactActivitiesApi>()),
  fetchContactThread: vi.fn(),
  sendContactActivity: vi.fn(),
  fetchContactMessagingStatus: vi.fn(),
  fetchContactTemplateValues: vi.fn(async () => ({
    clinicName: 'Cresence Skin',
    address: '',
    mapsLink: '',
    reviewLink: '',
    freeSlots: [],
  })),
}));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: vi.fn(() => 'desktop'),
  readViewportTier: vi.fn(() => 'desktop'),
}));

const CONTACT_ID = 'con_anaya0000000000000000';
const ANAYA_STREAM: ChatPerson = { kind: 'contact', contactId: CONTACT_ID };
const ANAYA: ChatContact = {
  name: 'Anaya Desai',
  phone: '+919879521034',
  isPatient: false,
  interests: ['clinical'],
};

const NOT_CONNECTED =
  'Messages wait in the queue · they go out once messaging is connected';
const OUTAGE = 'WhatsApp down · replies will queue';

/** A message as clinozy-be's stream answers a send: queued — nothing delivers it yet. */
const queued = (body: string): ChatMessage => ({
  id: 'msg_sent0000000000000001',
  channel: 'whatsapp',
  direction: 'sent',
  body,
  deliveryStatus: 'queued',
  isSystem: false,
  authorId: null,
  taskId: null,
  sentAt: '2026-10-03T09:30:00.000Z',
});

let client: QueryClient;
function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const renderChat = (props: ChatColumnProps) =>
  render(
    <Providers>
      <ChatColumn {...props} />
    </Providers>,
  );

const emptyStream = () =>
  vi
    .mocked(contactActivitiesApi.fetchContactThread)
    .mockResolvedValue({ thread: null, messages: [], authors: {} });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T09:30:00Z'));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({
    user: { id: 'user-1', email: 'riya@cresence.skin', role: 'user', name: 'Riya Shah' },
  });
  useLocaleStore.getState().setFormatLocale('en-IN');
  vi.mocked(contactActivitiesApi.fetchContactMessagingStatus).mockResolvedValue({
    whatsappDown: false,
    isConnected: false,
  });
  vi.mocked(contactActivitiesApi.sendContactActivity).mockReset();
  resetOutboxes();
  clearDrafts();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(contactActivitiesApi.fetchContactThread).mockReset();
  useAuthStore.setState({ user: null });
  useLocaleStore.getState().setFormatLocale('en-US');
  client.clear();
  resetOutboxes();
  clearDrafts();
});

describe('a contact’s stream on clinozy-be (the live reader)', () => {
  it('sends through clinozy-be and holds the reply "Queued"', async () => {
    const user = userEvent.setup();
    // The stream is empty, then holds what was sent once clinozy-be took it.
    vi.mocked(contactActivitiesApi.fetchContactThread)
      .mockResolvedValueOnce({ thread: null, messages: [], authors: {} })
      .mockResolvedValue({ thread: null, messages: [queued('Hello')], authors: {} });
    vi.mocked(contactActivitiesApi.sendContactActivity).mockResolvedValue(
      queued('Hello'),
    );
    renderChat({ person: ANAYA_STREAM, contact: ANAYA });

    expect(await screen.findByText(NOT_CONNECTED)).toBeVisible();
    await user.type(screen.getByTestId(ids.textarea), 'Hello{Enter}');

    await waitFor(() =>
      expect(contactActivitiesApi.sendContactActivity).toHaveBeenCalledWith({
        contactId: CONTACT_ID,
        channel: 'whatsapp',
        body: 'Hello',
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId(ids.bubble)).toHaveTextContent('Queued'),
    );
    expect(screen.getByTestId(ids.bubble)).toHaveTextContent('Hello');
    expect(screen.queryByText(OUTAGE)).toBeNull();
  });

  it('reads an unknown messaging status as fine: no queue note, no outage line, sending still works', async () => {
    emptyStream();
    vi.mocked(contactActivitiesApi.fetchContactMessagingStatus).mockRejectedValue(
      new Error('status unavailable'),
    );
    renderChat({ person: ANAYA_STREAM, contact: ANAYA });

    await screen.findByTestId(ids.textarea);
    await waitFor(() =>
      expect(contactActivitiesApi.fetchContactMessagingStatus).toHaveBeenCalled(),
    );
    expect(screen.queryByText(NOT_CONNECTED)).toBeNull();
    expect(screen.queryByText(OUTAGE)).toBeNull();
    expect(screen.getByTestId(ids.textarea)).toBeEnabled();
  });

  it('shows the failure in place when the stream cannot be read, and Retry reads it again', async () => {
    const user = userEvent.setup();
    vi.mocked(contactActivitiesApi.fetchContactThread)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        thread: null,
        messages: [queued('See you')],
        authors: {},
      });
    renderChat({ person: ANAYA_STREAM, contact: ANAYA });

    const failure = await screen.findByTestId('retry-error');
    expect(screen.queryByTestId(ids.textarea)).toBeNull();
    await user.click(within(failure).getByTestId('retry-button'));

    expect(await screen.findByTestId(ids.textarea)).toBeVisible();
    expect(screen.getByTestId(ids.bubble)).toHaveTextContent('See you');
    expect(contactActivitiesApi.fetchContactThread).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('retry-error')).toBeNull();
  });
});

describe('the header and the composer’s edges', () => {
  it('shows no phone line for a person with no mobile', async () => {
    emptyStream();
    renderChat({ person: ANAYA_STREAM, contact: { ...ANAYA, phone: null } });
    const header = screen.getByTestId(ids.header);
    expect(header).toHaveTextContent('Anaya Desai');
    expect(header).not.toHaveTextContent(/\d{5}/);
    await screen.findByTestId(ids.textarea);
  });

  it('wraps the identity in the host’s contact card when it passes one', async () => {
    emptyStream();
    renderChat({
      person: ANAYA_STREAM,
      contact: ANAYA,
      contactCard: { load: () => new Promise(() => undefined) },
    });
    const trigger = within(screen.getByTestId(ids.header)).getByRole('button', {
      name: /Anaya Desai/,
    });
    expect(trigger).toHaveAttribute('data-slot', 'person-card-trigger');
    await screen.findByTestId(ids.textarea);
  });

  it('offers no booking when the host takes none', async () => {
    emptyStream();
    renderChat({ person: ANAYA_STREAM, contact: ANAYA });
    await screen.findByTestId(ids.textarea);
    expect(screen.queryByTestId(ids.book)).toBeNull();
  });

  it('has no accessibility violations on a failed read', async () => {
    vi.mocked(contactActivitiesApi.fetchContactThread).mockRejectedValue(
      new Error('offline'),
    );
    const { container } = renderChat({ person: ANAYA_STREAM, contact: ANAYA });
    await screen.findByTestId('retry-error');
    vi.useRealTimers();
    expect(await axe(container)).toHaveNoViolations();
  });
});
