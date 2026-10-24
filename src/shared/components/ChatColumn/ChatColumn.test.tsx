import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import * as contactActivitiesApi from '@/shared/api/app/contact-activities-api.ts';
import { setFixtureWhatsAppOutage } from '@/shared/api/app/fixtures/messages.fixtures.ts';
import { patientRef } from '@/shared/api/app/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import {
  appFixtures,
  resetAppFixtures,
} from '@/shared/api/app/fixtures/world.fixtures.ts';
import * as messagesApi from '@/shared/api/app/messages-api.ts';
import type { ChatPerson } from '@/shared/api/app/messages-contracts.ts';
import { resetOutboxes } from '@/shared/hooks/useThread/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi, withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';

import { CHAT_COLUMN_TEST_IDS as ids } from './chat-column.constants.ts';
import type { ChatContact } from './chat-composer.ts';
import { clearDrafts } from './chat-drafts.ts';
import { ChatColumn, type ChatColumnProps } from './ChatColumn.tsx';

vi.mock('@/shared/api/app/messages-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof messagesApi>();
  return { ...actual, sendMessage: vi.fn(actual.sendMessage) };
});
// A contact's stream is clinozy-be's (`/app/contacts/:contact_id/activities`).
vi.mock('@/shared/api/app/contact-activities-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof contactActivitiesApi>()),
  fetchContactThread: vi.fn(),
  fetchContactMessagingStatus: vi.fn(async () => ({
    whatsappDown: false,
    isConnected: false,
  })),
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

const ANAYA: ChatPerson = { kind: 'lead', leadId: ref.lead(2363) };
const ANAYA_CONTACT: ChatContact = {
  name: 'Anaya Desai',
  phone: '+919879521034',
  isPatient: false,
  interests: ['clinical'],
};
const KABIR: ChatPerson = { kind: 'lead', leadId: ref.lead(2364) };
const KABIR_CONTACT: ChatContact = {
  name: 'Kabir Mehta',
  phone: '+919925044710',
  isPatient: false,
  instagram: '@kabir.m',
};
const MEHUL: ChatPerson = { kind: 'lead', leadId: ref.lead(2356) };
const MEHUL_CONTACT: ChatContact = {
  name: 'Mehul Solanki',
  phone: '+918780891089',
  isPatient: false,
};
const DHARTI: ChatPerson = { kind: 'patient', patientId: patientRef('Dharti Galani') };
const DHARTI_CONTACT: ChatContact = {
  name: 'Dharti Galani',
  phone: '+918200603212',
  isPatient: true,
};

let client: QueryClient;
function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderChat(props: ChatColumnProps) {
  const view = render(
    <Providers>
      <ChatColumn {...props} />
    </Providers>,
  );
  return {
    ...view,
    show: (next: ChatColumnProps) =>
      view.rerender(
        <Providers>
          <ChatColumn {...next} />
        </Providers>,
      ),
  };
}

const textarea = () => screen.getByTestId(ids.textarea);
const bubbles = () => screen.queryAllByTestId(ids.bubble);

beforeEach(() => {
  // 15:00 in the clinic (IST), after every seeded message of the day.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T09:30:00Z'));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({
    user: { id: 'user-1', email: 'riya@cresence.skin', role: 'user', name: 'Riya Shah' },
  });
  vi.mocked(useViewportTier).mockReturnValue('desktop');
  // The clinic's regional format: "30 Sep", "4:00 pm" (the design's).
  useLocaleStore.getState().setFormatLocale('en-IN');
  resetAppFixtures();
  resetOutboxes();
  clearDrafts();
});
afterEach(() => {
  // Unmount before the stores reset, so no column re-renders on the way out.
  cleanup();
  vi.useRealTimers();
  vi.mocked(messagesApi.sendMessage).mockClear();
  useAuthStore.setState({ user: null });
  useLocaleStore.getState().setFormatLocale('en-US');
  client.clear();
  resetAppFixtures();
  resetOutboxes();
  clearDrafts();
});

describe('the conversation', () => {
  it('shows the contact, the divider, the system line and their messages', async () => {
    const { container } = renderChat({ person: ANAYA, contact: ANAYA_CONTACT });
    const header = screen.getByTestId(ids.header);
    expect(within(header).getByText('Anaya Desai')).toBeVisible();
    expect(within(header).getByText('+91 98795 21034')).toBeVisible();
    // The name in its own direction, the phone always left to right — whole on
    // a right-to-left page, each aligned as the header is, in this order.
    expect(within(header).getByText('Anaya Desai')).toHaveAttribute('dir', 'auto');
    expect(within(header).getByText('+91 98795 21034')).toHaveAttribute('dir', 'ltr');
    expect(within(header).getByText('+91 98795 21034')).toHaveClass(
      '[text-align:match-parent]',
    );
    expect(header).toHaveTextContent('Anaya Desai+91 98795 21034');
    expect(screen.getByRole('region', { name: 'Anaya Desai' })).toBeInTheDocument();

    expect(await screen.findByTestId(ids.divider)).toHaveTextContent(
      // The rule's time is an isolated token beside its day word.
      `Lead created · Today ${fsi('10:28 am')} · via WhatsApp`,
    );
    expect(screen.getByTestId(ids.system)).toHaveTextContent(
      'Lead created from WhatsApp ad',
    );
    expect(bubbles().map((bubble) => bubble.dataset.kind)).toEqual(['in', 'in']);
    expect(bubbles()[0]).toHaveTextContent(
      'Hi, I have acne scars since 2 years. What is the treatment and price?',
    );
    expect(bubbles()[0]).toHaveTextContent(`${fsi('Anaya')}·WhatsApp10:28 am`);
    expect(screen.getByRole('log', { name: 'Messages' })).toBeInTheDocument();
    expect(screen.getByText(`${fsi('Anaya')} last wrote here`)).toBeVisible();
    expect(screen.getByRole('tab', { name: 'WhatsApp' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(textarea()).toHaveAttribute('placeholder', 'Message to Anaya on WhatsApp');
    expect(screen.getByTestId(ids.send)).toHaveTextContent('Send WhatsApp');
    // Let the history, status and template reads land before the async axe pass.
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('merges a patient’s contact history in, oldest first, and opens a chip’s record', async () => {
    const onOpenHistory = vi.fn();
    const user = userEvent.setup();
    renderChat({ person: DHARTI, contact: DHARTI_CONTACT, onOpenHistory });
    expect(
      within(screen.getByTestId(ids.header)).getByTestId('patient-badge'),
    ).toBeVisible();
    await waitFor(() => expect(screen.getAllByTestId(ids.history)).toHaveLength(12));
    // The parts are isolated and a time's own space is unbreakable (U+00A0):
    // read the words and their order.
    const chips = screen
      .getAllByTestId(ids.history)
      .map((chip) => withoutBidiMarks(chip.textContent).replace(/\u00a0/gu, ' '));
    expect(chips[0]).toBe('Appointment #2740 · Peel · Completed · Dr. NishaWed 2:50 pm');
    expect(chips).toContain('Clinic invoice #787 · ₹4,800 · ₹4,800 dueWed');
    expect(chips.at(-1)).toBe(
      'Appointment #2859 · Peel · Confirmed · Dr. Nisha14 Oct 11:00 am',
    );
    expect(screen.getByTestId(ids.divider)).toHaveTextContent(
      `Lead created · ${fsi('22 Aug')} ${fsi('10:00 am')} · via Instagram`,
    );

    await user.click(screen.getAllByTestId(ids.history)[0] as HTMLElement);
    expect(onOpenHistory).toHaveBeenCalledWith({
      kind: 'appointment',
      appointmentId: ref.appointment(2740),
    });
  });

  it('masks every ₹ behind the patient file’s privacy', async () => {
    renderChat({ person: DHARTI, contact: DHARTI_CONTACT, maskMoney: true });
    await waitFor(() => expect(screen.getAllByTestId(ids.history)).toHaveLength(12));
    const chips = screen
      .getAllByTestId(ids.history)
      .map((chip) => withoutBidiMarks(chip.textContent).replace(/\u00a0/gu, ' '));
    expect(chips).toContain('Clinic invoice #787 · ₹ •••• · ₹ •••• dueWed');
    expect(chips.join(' ')).not.toMatch(/₹\d/);
  });

  it('reads a contact’s stream, its divider from the lead the host shows it for', async () => {
    const riya = 'mem_riya00000000000000000';
    vi.mocked(contactActivitiesApi.fetchContactThread).mockResolvedValue({
      thread: null,
      messages: [
        {
          id: 'msg_anaya0000000000000001',
          channel: 'instagram',
          direction: 'received',
          body: 'Is PRP available on Saturday?',
          deliveryStatus: 'delivered',
          isSystem: false,
          authorId: null,
          taskId: null,
          sentAt: '2026-10-03T05:10:00.000Z',
        },
        {
          id: 'msg_anaya0000000000000002',
          channel: 'instagram',
          direction: 'sent',
          body: 'Yes — 11:30 is free.',
          deliveryStatus: 'read',
          isSystem: false,
          authorId: riya,
          taskId: null,
          sentAt: '2026-10-03T05:20:00.000Z',
        },
      ],
      authors: {
        [riya]: {
          id: riya,
          name: 'Riya Shah',
          initials: 'RS',
          tone: 'blush',
          roles: [],
          phone: null,
          email: null,
        },
      },
    });
    renderChat({
      person: { kind: 'contact', contactId: 'con_anaya0000000000000000' },
      contact: { ...ANAYA_CONTACT, instagram: '@anaya.d' },
      lead: {
        leadId: 'lead_anaya0000000000000000',
        kind: 'enquiry',
        createdAt: '2026-10-03T04:58:00.000Z',
        source: 'instagram',
        patientId: null,
      },
    });

    expect(await screen.findByTestId(ids.divider)).toHaveTextContent(
      `Lead created · Today ${fsi('10:28 am')} · via Instagram`,
    );
    expect(contactActivitiesApi.fetchContactThread).toHaveBeenCalledWith(
      'con_anaya0000000000000000',
    );
    expect(bubbles().map((bubble) => bubble.dataset.kind)).toEqual(['in', 'out']);
    expect(bubbles()[0]).toHaveTextContent('Is PRP available on Saturday?');
    // The member the stream names signs our reply.
    expect(bubbles()[1]).toHaveTextContent(`${fsi('Riya S.')}·Instagram`);
    // They last wrote on Instagram: the composer opens there.
    expect(screen.getByRole('tab', { name: 'Instagram' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('holds a contact’s queued messages "Queued", and says they wait for messaging to be connected', async () => {
    vi.mocked(contactActivitiesApi.fetchContactThread).mockResolvedValue({
      thread: null,
      messages: [
        {
          id: 'msg_anaya0000000000000003',
          channel: 'instagram',
          direction: 'sent',
          body: 'See you at 11:30',
          deliveryStatus: 'queued',
          isSystem: false,
          authorId: null,
          taskId: null,
          sentAt: '2026-10-03T05:30:00.000Z',
        },
      ],
      authors: {},
    });
    renderChat({
      person: { kind: 'contact', contactId: 'con_anaya0000000000000000' },
      contact: { ...ANAYA_CONTACT, instagram: '@anaya.d' },
    });

    expect(
      await screen.findByText(
        'Messages wait in the queue · they go out once messaging is connected',
      ),
    ).toBeVisible();
    expect(bubbles()[0]).toHaveTextContent('Queued');
    expect(screen.queryByText('WhatsApp down · replies will queue')).toBeNull();
  });

  it('shows the skeleton while the thread loads', () => {
    renderChat({ person: ANAYA, contact: ANAYA_CONTACT });
    expect(screen.getByTestId('skeleton-rows')).toBeInTheDocument();
  });
});

describe('no conversation yet', () => {
  it('draws the dashed card with the situational line and three starters', async () => {
    const user = userEvent.setup();
    renderChat({ person: MEHUL, contact: MEHUL_CONTACT });
    const empty = await screen.findByTestId('empty-state');
    expect(
      within(empty).getByRole('heading', { name: 'No conversation yet' }),
    ).toBeVisible();
    expect(empty).toHaveTextContent('Start with a WhatsApp · replies land here');
    expect(screen.getAllByTestId(ids.starter).map((chip) => chip.textContent)).toEqual([
      'Say hello',
      'Offer a consultation',
      'Send directions',
    ]);

    await user.click(screen.getByTestId(`${ids.mode}-call`));
    await user.click(screen.getByRole('button', { name: 'Say hello' }));
    expect(screen.getByRole('tab', { name: 'WhatsApp' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(textarea()).toHaveValue(
      'Hi Mehul, this is Riya S. from Cresence Skin. Happy to help with anything you need.',
    );
    expect(textarea()).toHaveFocus();
  });

  it('reads "Patient · chat only · no lead" for a patient without a thread', async () => {
    renderChat({
      person: { kind: 'patient', patientId: patientRef('Kiran Desai') },
      contact: { name: 'Kiran Desai', phone: '+919879521034', isPatient: true },
    });
    expect(await screen.findByTestId(ids.divider)).toHaveTextContent(
      'Patient · chat only · no lead',
    );
  });
});

describe('a member who may read but not write (QA-07)', () => {
  it('shows the thread without the composer, the starters or "Book"', async () => {
    renderChat({
      person: ANAYA,
      contact: ANAYA_CONTACT,
      canSend: false,
      onBookAppointment: vi.fn(),
    });
    expect(await screen.findByTestId(ids.divider)).toBeInTheDocument();
    expect(screen.queryByTestId(ids.composer)).not.toBeInTheDocument();
    expect(screen.queryByTestId(ids.textarea)).not.toBeInTheDocument();
    expect(screen.queryByTestId(ids.send)).not.toBeInTheDocument();
    expect(screen.queryByTestId(ids.book)).not.toBeInTheDocument();
    expect(screen.queryAllByTestId(ids.starter)).toHaveLength(0);
  });
});

describe('drafts (KICKOFF §3.5)', () => {
  it('keeps each person’s unsent text and brings it back on return', async () => {
    const user = userEvent.setup();
    const view = renderChat({ person: ANAYA, contact: ANAYA_CONTACT });
    await screen.findByTestId(ids.textarea);
    await user.type(textarea(), 'Saturday 11:30 works');

    view.show({ person: KABIR, contact: KABIR_CONTACT });
    await waitFor(() =>
      expect(textarea()).toHaveAttribute('placeholder', 'Message to Kabir on Instagram'),
    );
    expect(textarea()).toHaveValue('');
    await user.type(textarea(), 'Calling at 11');

    view.show({ person: ANAYA, contact: ANAYA_CONTACT });
    await waitFor(() => expect(textarea()).toHaveValue('Saturday 11:30 works'));

    view.show({ person: KABIR, contact: KABIR_CONTACT });
    await waitFor(() => expect(textarea()).toHaveValue('Calling at 11'));
  });

  it('forgets a draft once it is sent', async () => {
    const user = userEvent.setup();
    const view = renderChat({ person: ANAYA, contact: ANAYA_CONTACT });
    await screen.findByTestId(ids.textarea);
    await user.type(textarea(), 'Hi Anaya{Enter}');
    view.show({ person: KABIR, contact: KABIR_CONTACT });
    await waitFor(() =>
      expect(textarea()).toHaveAttribute('placeholder', 'Message to Kabir on Instagram'),
    );
    view.show({ person: ANAYA, contact: ANAYA_CONTACT });
    await waitFor(() =>
      expect(textarea()).toHaveAttribute('placeholder', 'Message to Anaya on WhatsApp'),
    );
    expect(textarea()).toHaveValue('');
  });
});

describe('sending', () => {
  it('sends on Enter: "Sending…" at once, then the reply and the status line', async () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const actual = vi.mocked(messagesApi.sendMessage).getMockImplementation();
    vi.mocked(messagesApi.sendMessage).mockImplementationOnce(async (input) => {
      await held;
      if (!actual) throw new Error('no implementation');
      return actual(input);
    });
    const user = userEvent.setup();
    renderChat({ person: ANAYA, contact: ANAYA_CONTACT });
    await screen.findByTestId(ids.textarea);

    await user.type(textarea(), 'Hi Anaya, Saturday 11:30 works.{Enter}');
    expect(textarea()).toHaveValue('');
    const pending = bubbles().at(-1);
    expect(pending).toHaveAttribute('data-kind', 'out');
    expect(pending).toHaveTextContent('Hi Anaya, Saturday 11:30 works.');
    // Named at once — the signed-in member — before the server names the author.
    expect(pending).toHaveTextContent(`${fsi('Riya S.')}·WhatsApp`);
    expect(pending).toHaveTextContent('Sending…');

    release();
    await waitFor(() =>
      expect(screen.getAllByTestId(ids.system).at(-1)).toHaveTextContent(
        'Status → Contacted (first reply)',
      ),
    );
    const sent = bubbles().at(-1);
    expect(sent).toHaveTextContent(`${fsi('Riya S.')}·WhatsApp`);
    expect(sent).toHaveTextContent('·Sent');
    expect(messagesApi.sendMessage).toHaveBeenCalledWith({
      leadId: ref.lead(2363),
      channel: 'whatsapp',
      body: 'Hi Anaya, Saturday 11:30 works.',
    });
  });

  it('breaks a line on Shift+Enter and sends nothing blank', async () => {
    const user = userEvent.setup();
    renderChat({ person: ANAYA, contact: ANAYA_CONTACT });
    await screen.findByTestId(ids.textarea);
    await user.type(textarea(), 'Line one{Shift>}{Enter}{/Shift}Line two');
    expect(textarea()).toHaveValue('Line one\nLine two');
    await user.clear(textarea());
    await user.type(textarea(), '   {Enter}');
    await user.click(screen.getByTestId(ids.send));
    expect(messagesApi.sendMessage).not.toHaveBeenCalled();
  });

  it('marks a failed send "Not sent" and sends it again on Retry', async () => {
    vi.mocked(messagesApi.sendMessage).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    renderChat({ person: ANAYA, contact: ANAYA_CONTACT });
    await screen.findByTestId(ids.textarea);
    await user.type(textarea(), 'Are you free today?{Enter}');

    const failed = await screen.findByTestId(ids.retry);
    expect(bubbles().at(-1)).toHaveTextContent('Are you free today?');
    expect(bubbles().at(-1)).toHaveTextContent('Not sent');

    await user.click(failed);
    await waitFor(() => expect(screen.queryByText('Not sent')).not.toBeInTheDocument());
    await waitFor(() => expect(bubbles().at(-1)).toHaveTextContent('·Sent'));
    expect(messagesApi.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('resends a message its provider could not deliver', async () => {
    const user = userEvent.setup();
    renderChat({ person: KABIR, contact: KABIR_CONTACT });
    const retry = await screen.findByTestId(ids.retry);
    expect(retry.closest(`[data-testid="${ids.bubble}"]`)).toHaveTextContent(
      'Yes. A counsellor will call you by 11:00 with details.',
    );
    await user.click(retry);
    await waitFor(() => expect(screen.queryByTestId(ids.retry)).not.toBeInTheDocument());
    const message = appFixtures.leadMessages.snapshot(
      (row) => row.body === 'Yes. A counsellor will call you by 11:00 with details.',
    )[0];
    expect(message?.deliveryStatus).toBe('sent');
  });

  it('keeps WhatsApp replies "Queued" while WhatsApp is down, and says so', async () => {
    setFixtureWhatsAppOutage(true);
    const user = userEvent.setup();
    renderChat({ person: ANAYA, contact: ANAYA_CONTACT });
    expect(await screen.findByText('WhatsApp down · replies will queue')).toBeVisible();
    await user.type(textarea(), 'Hello?{Enter}');
    await waitFor(() => expect(bubbles().at(-1)).toHaveTextContent('·Queued'));
  });

  it('opens the booking with the reason from their last message', async () => {
    const onBookAppointment = vi.fn();
    const user = userEvent.setup();
    renderChat({ person: ANAYA, contact: ANAYA_CONTACT, onBookAppointment });
    await user.click(await screen.findByRole('button', { name: 'Book an appointment' }));
    expect(onBookAppointment).toHaveBeenCalledWith({ reason: 'Is Saturday possible?' });
  });
});

describe('"Send via"', () => {
  it('switches channel: the tint, placeholder, Send label and what the bar offers', async () => {
    const user = userEvent.setup();
    renderChat({ person: ANAYA, contact: ANAYA_CONTACT, onBookAppointment: vi.fn() });
    await screen.findByTestId(ids.textarea);
    expect(screen.getByTestId(ids.composer)).toHaveClass('bg-tone-sage');

    await user.click(screen.getByRole('tab', { name: 'Call log' }));
    expect(screen.getByTestId(ids.composer)).toHaveClass('bg-tone-sky');
    expect(textarea()).toHaveAttribute('placeholder', 'What happened on the call?');
    expect(screen.getByTestId(ids.send)).toHaveTextContent('Log call');
    expect(screen.queryByTestId(ids.suggest)).not.toBeInTheDocument();
    expect(screen.queryByTestId(ids.book)).not.toBeInTheDocument();
    expect(screen.queryByText('Anaya last wrote here')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Note' }));
    expect(textarea()).toHaveAttribute(
      'placeholder',
      'Note for the team, not sent to Anaya',
    );
    expect(screen.getByTestId(ids.send)).toHaveTextContent('Add note');
  });

  it('moves between tabs with the arrow keys and never picks a disabled Instagram', async () => {
    const user = userEvent.setup();
    renderChat({ person: ANAYA, contact: ANAYA_CONTACT });
    await screen.findByTestId(ids.textarea);
    const instagram = screen.getByRole('tab', { name: 'Instagram' });
    expect(instagram).toBeDisabled();
    await user.click(instagram);
    expect(instagram).toHaveAttribute('aria-selected', 'false');

    await user.click(screen.getByRole('tab', { name: 'WhatsApp' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Call log' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Call log' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Note' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'WhatsApp' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('offers to switch to the channel they last wrote on', async () => {
    const user = userEvent.setup();
    renderChat({ person: KABIR, contact: KABIR_CONTACT });
    await screen.findByText(`${fsi('Kabir')} last wrote here`);
    await user.click(screen.getByRole('tab', { name: 'WhatsApp' }));
    await user.click(screen.getByTestId(ids.mismatch));
    expect(screen.getByRole('tab', { name: 'Instagram' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('warns about their contact preferences', async () => {
    const user = userEvent.setup();
    renderChat({
      person: ANAYA,
      contact: { ...ANAYA_CONTACT, preferences: ['no_calls', 'after_six_pm'] },
    });
    expect(await screen.findByText('Prefers contact after 6 pm')).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'Call log' }));
    expect(screen.getByText('Prefers no calls · message instead')).toBeVisible();
  });

  it('labels the tabs when the host asks — never on a phone', async () => {
    renderChat({ person: ANAYA, contact: ANAYA_CONTACT, showModeLabels: true });
    const tabs = await screen.findByTestId(ids.modes);
    expect(within(tabs).getByText('Call log')).toBeVisible();

    vi.mocked(useViewportTier).mockReturnValue('phone');
    client.clear();
    const phone = renderChat({
      person: KABIR,
      contact: KABIR_CONTACT,
      showModeLabels: true,
    });
    await waitFor(() => expect(phone.getAllByTestId(ids.modes)).toHaveLength(2));
    const phoneTabs = phone.getAllByTestId(ids.modes)[1] as HTMLElement;
    expect(within(phoneTabs).queryByText('Call log')).not.toBeInTheDocument();
    expect(within(phoneTabs).getByRole('tab', { name: 'Call log' })).toBeInTheDocument();
  });
});

describe('suggestions and templates', () => {
  it('opens above the box with chips and templates; a pick fills the box and closes it', async () => {
    const user = userEvent.setup();
    renderChat({ person: ANAYA, contact: ANAYA_CONTACT });
    await screen.findByTestId(ids.textarea);
    await user.click(screen.getByRole('button', { name: 'Suggest' }));

    const popover = await screen.findByRole('dialog', { name: 'Suggested for Anaya' });
    expect(
      within(popover)
        .getAllByTestId(ids.suggestionChip)
        .map((chip) => chip.textContent),
    ).toEqual(['Greet', 'Offer 2 slots', 'Follow up']);
    expect(
      within(popover).getByText('Templates · type / in the box to search'),
    ).toBeVisible();
    expect(
      within(popover).getAllByRole('button', {
        name: /Hi Anaya|We are|Thank you|B1G1|We have/,
      }),
    ).not.toHaveLength(0);
    expect(await axeForDialog(document.body)).toHaveNoViolations();

    await user.click(within(popover).getByTestId(`${ids.template}-aftercare`));
    expect(textarea()).toHaveValue(
      'Hi Anaya, how is the skin feeling today? Keep it moisturised, use sunscreen and avoid scrubs for 48 hours.',
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Suggested for Anaya' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('opens on "/" and searches the templates; closing clears the search', async () => {
    const user = userEvent.setup();
    renderChat({ person: ANAYA, contact: ANAYA_CONTACT });
    await screen.findByTestId(ids.textarea);
    await user.type(textarea(), '/zzz');
    const popover = await screen.findByRole('dialog', { name: 'Suggested for Anaya' });
    expect(within(popover).getByText('No template matches “zzz”')).toBeVisible();

    await user.clear(textarea());
    await user.type(textarea(), '/loc');
    await waitFor(() =>
      expect(
        within(screen.getByRole('dialog')).getAllByTestId(/^chat-template-/),
      ).toHaveLength(1),
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Close suggestions',
      }),
    );
    expect(textarea()).toHaveValue('');
  });

  it('fills each placeholder with the clinic’s value, first one first', async () => {
    const user = userEvent.setup();
    renderChat({ person: ANAYA, contact: ANAYA_CONTACT });
    await screen.findByTestId(ids.textarea);
    await user.type(textarea(), '/loc');
    await user.click(await screen.findByTestId(`${ids.template}-location`));
    expect(screen.getAllByTestId(ids.fillIn).map((chip) => chip.textContent)).toEqual([
      'address',
      'maps link',
    ]);
    await waitFor(() => expect(screen.getAllByTestId(ids.fillIn)).toHaveLength(2));
    await user.click(screen.getAllByTestId(ids.fillIn)[1] as HTMLElement);
    expect(textarea()).toHaveValue(
      'We are at 3rd floor, Shree Hari Complex, Near Star Bazaar, Adajan Gam Road, Adajan, Surat · Google Maps: {{maps link}}. Parking is available right outside.',
    );
    await user.click(screen.getByTestId(ids.fillIn));
    expect(textarea()).toHaveValue(
      'We are at 3rd floor, Shree Hari Complex, Near Star Bazaar, Adajan Gam Road, Adajan, Surat · Google Maps: maps.app.goo.gl/cresence. Parking is available right outside.',
    );
    expect(screen.queryByTestId(ids.fillIn)).not.toBeInTheDocument();
  });
});
