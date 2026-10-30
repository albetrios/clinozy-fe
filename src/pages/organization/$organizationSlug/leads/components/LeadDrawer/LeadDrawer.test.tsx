import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as AppointmentsApiModule from '@/shared/api/app/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/app/appointments-contracts.ts';
import type * as ContactActivitiesApiModule from '@/shared/api/app/contact-activities-api.ts';
import { fetchContactThread } from '@/shared/api/app/contact-activities-api.ts';
import type * as ContactsApiModule from '@/shared/api/app/contacts-api.ts';
import { fetchContact, updateContact } from '@/shared/api/app/contacts-api.ts';
import type * as DirectoryApiModule from '@/shared/api/app/directory-api.ts';
import type * as LeadsApiModule from '@/shared/api/app/leads-api.ts';
import {
  countOpenLeadTasks,
  deleteLead,
  restoreLead,
  updateLead,
} from '@/shared/api/app/leads-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import type * as NotifyModule from '@/shared/notify/index.ts';
import {
  LEAD_CHAT_WIDTH,
  useDevicePrefsStore,
} from '@/shared/store/useDevicePrefsStore/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import type * as MyMembershipModule from '@/shared/tenancy/my-membership.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { appointmentRow } from '@/tests/utils/appointment-doubles.ts';

import {
  contactRecord,
  type ContactsWorld,
  daysAgo,
  leadRecord,
  type LeadsWorld,
  NOW,
  seededLeadsWorld,
} from '../../__tests__/integration/leads-test-data.ts';
import { renderLeadsRoutes } from '../../__tests__/integration/leads-test-router.tsx';
import { LeadsPage } from '../../LeadsPage.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    undo: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof NotifyModule>()),
  notify: notifyMock,
}));
const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));
/**
 * Whether the member may book (`appointment:create`) and read tasks (`task:read`) — every other
 * ability is granted.
 */
const access = vi.hoisted(() => ({ book: true, tasks: true, read: true, write: true }));
vi.mock('@/shared/hooks/useAppAccess/index.ts', () => ({
  useAppAccess: () => ({
    previewRole: null,
    can: (section: string) =>
      (section !== 'appointments' || access.book) &&
      (section !== 'tasks' || access.tasks),
    canCode: (code: string) =>
      (code !== 'contact_activity:create' || access.write) &&
      (code !== 'contact_activity:read' || access.read),
    viewableSections: [],
    isResolved: true,
  }),
}));

const world = vi.hoisted(() => ({}) as LeadsWorld);
const people = vi.hoisted(() => ({}) as ContactsWorld);
vi.mock('@/shared/api/app/leads-api.ts', async (importOriginal) => {
  const { leadsApiDouble } =
    await import('../../__tests__/integration/leads-test-data.ts');
  return { ...(await importOriginal<typeof LeadsApiModule>()), ...leadsApiDouble(world) };
});
vi.mock('@/shared/api/app/contacts-api.ts', async (importOriginal) => {
  const { contactsApiDouble } =
    await import('../../__tests__/integration/leads-test-data.ts');
  return {
    ...(await importOriginal<typeof ContactsApiModule>()),
    ...contactsApiDouble(people),
  };
});
vi.mock('@/shared/api/app/contact-activities-api.ts', async (importOriginal) => {
  const { contactActivitiesApiDouble } =
    await import('../../__tests__/integration/leads-test-data.ts');
  return {
    ...(await importOriginal<typeof ContactActivitiesApiModule>()),
    ...contactActivitiesApiDouble(),
  };
});
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => {
  const { directoryApiDouble } =
    await import('../../__tests__/integration/leads-test-data.ts');
  return {
    ...(await importOriginal<typeof DirectoryApiModule>()),
    ...directoryApiDouble(),
  };
});
/** The person's bookings, as `GET /app/appointments?contact_id=` answers them — none by default. */
const bookings = vi.hoisted(() => ({ rows: [] as AppointmentRow[] }));
// The stacked appointment form's reads: the day's free starts, no treatments; the person's bookings.
vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => {
  const { slotDay } = await import('@/tests/utils/appointment-doubles.ts');
  return {
    ...(await importOriginal<typeof AppointmentsApiModule>()),
    fetchAppointmentSlots: vi.fn(async ({ date }: { date: string }) =>
      slotDay(date, ['10:00', '10:30']),
    ),
    fetchPersonAppointments: vi.fn(async () => bookings.rows),
  };
});
// The one offerings catalogue — the booking step's "From offerings": empty here.
vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllOfferings: vi.fn(async () => []),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof MyMembershipModule>()),
  findMyMembershipId: vi.fn(async () => world.viewerId),
}));

const ANAYA = leadRecord();
const LEADS = '/organization/acme/leads';

const initialHourCycle = useLocaleStore.getState().hourCycle;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  useLocaleStore.setState({ hourCycle: 'h12' });
  for (const mock of Object.values(notifyMock)) mock.mockReset();
  useDevicePrefsStore.setState({ leadChatWidth: LEAD_CHAT_WIDTH.initial });
  Object.assign(world, seededLeadsWorld());
  Object.assign(people, { contacts: [contactRecord()] });
  vi.resetAllMocks();
  access.book = true;
  bookings.rows = [];
  access.tasks = true;
  access.read = true;
  access.write = true;
  signInTestMember();
});
afterEach(() => {
  vi.useRealTimers();
  useLocaleStore.setState({ hourCycle: initialHourCycle });
  useOrganizationStore.getState().clearOrganization();
});

async function openAnaya() {
  const view = renderLeadsRoutes(`${LEADS}/${ANAYA.id}?view=all`, LeadsPage);
  const drawer = await screen.findByTestId('lead-drawer');
  await within(drawer).findByRole('heading', { name: 'Edit lead' });
  return { ...view, drawer };
}

/** An Info cell's text, its label first. */
const infoCell = (drawer: HTMLElement, label: string) =>
  within(within(drawer).getByRole('region', { name: 'Info' }))
    .getByText(label)
    .closest('div');

describe('LeadDrawer (KICKOFF §6.3)', () => {
  it('opens the details and the chat side by side, the title focused', async () => {
    const { drawer } = await openAnaya();
    expect(within(drawer).getByRole('heading', { name: 'Edit lead' })).toHaveFocus();
    expect(
      within(drawer).getByRole('button', { name: 'Copy lead ID #2363' }),
    ).toBeInTheDocument();
    for (const name of ['Lead details', 'Progress', 'Info']) {
      expect(within(drawer).getByRole('region', { name })).toBeInTheDocument();
    }
    expect(within(drawer).getByTestId('lead-drawer-chat')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Save lead' })).toBeDisabled();
    // The person comes from their contact; the chat from their stream.
    expect(fetchContact).toHaveBeenCalledWith(ANAYA.contactId);
    await waitFor(() => expect(fetchContactThread).toHaveBeenCalledWith(ANAYA.contactId));
  });

  it('opens the chat on the lead’s divider: when it was created, and its source', async () => {
    const { drawer } = await openAnaya();
    const chat = within(drawer).getByTestId('lead-drawer-chat');
    expect(
      await within(chat).findByText(
        /^Lead created · Wed \W?10:00\sAM\W? · via WhatsApp$/i,
      ),
    ).toBeInTheDocument();
  });

  it('reads Info: created, the person’s last activity, the patient file and open tasks', async () => {
    const { drawer } = await openAnaya();
    expect(infoCell(drawer, 'Created')).toHaveTextContent(
      /^CreatedWed \W?10:00\sAM\W?$/i,
    );
    expect(infoCell(drawer, 'Last activity')).toHaveTextContent(
      /^Last activityYesterday \W?10:00\sAM\W?$/i,
    );
    expect(infoCell(drawer, 'Patient')).toHaveTextContent(/^PatientNot yet$/);
    await waitFor(() =>
      expect(infoCell(drawer, 'Open tasks')).toHaveTextContent(/^Open tasks1$/),
    );
    expect(countOpenLeadTasks).toHaveBeenCalledWith(ANAYA.id);
  });

  it('leaves Open tasks out for a member who reads no tasks (a role without task:read)', async () => {
    access.tasks = false;
    vi.mocked(countOpenLeadTasks).mockClear();
    const { drawer } = await openAnaya();
    expect(infoCell(drawer, 'Created')).toBeInTheDocument();
    expect(
      within(within(drawer).getByRole('region', { name: 'Info' })).queryByText(
        'Open tasks',
      ),
    ).not.toBeInTheDocument();
    expect(countOpenLeadTasks).not.toHaveBeenCalled();
  });

  it('reads "None yet" before any activity, and "Linked" once a check-in opened a file', async () => {
    world.leads = [
      leadRecord({ lastActivityAt: null, patientId: 'pat_anaya0000000000000000' }),
    ];
    const { drawer } = await openAnaya();
    expect(infoCell(drawer, 'Last activity')).toHaveTextContent(
      /^Last activityNone yet$/,
    );
    expect(infoCell(drawer, 'Patient')).toHaveTextContent(/^PatientLinked$/);
  });

  it('reads when a closed lead closed, and no close date while it is open (clinozy-be D10)', async () => {
    const open = await openAnaya();
    expect(
      within(within(open.drawer).getByRole('region', { name: 'Info' })).queryByText(
        'Closed',
      ),
    ).not.toBeInTheDocument();
    open.unmount();

    world.leads = [leadRecord({ status: 'lost', closedAt: daysAgo(1) })];
    const { drawer } = await openAnaya();
    expect(infoCell(drawer, 'Closed')).toHaveTextContent(
      /^ClosedYesterday \W?10:00\sAM\W?$/i,
    );
  });

  it('saves a status move with the read’s `updated_at` — "<name> → <status>", no Undo', async () => {
    const user = userEvent.setup();
    const { drawer } = await openAnaya();
    const progress = within(drawer).getByRole('region', { name: 'Progress' });
    await user.click(within(progress).getByRole('button', { name: /Contacted/ }));
    expect(within(drawer).getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Save lead' }));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Anaya Desai → Contacted'),
    );
    expect(updateLead).toHaveBeenCalledExactlyOnceWith({
      leadId: ANAYA.id,
      fields: { status: 'contacted' },
      expectedUpdatedAt: ANAYA.updatedAt,
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.undo).not.toHaveBeenCalled();
    expect(world.leads[0]?.status).toBe('contacted');
    await waitFor(() =>
      expect(within(drawer).getByRole('button', { name: 'Save lead' })).toBeDisabled(),
    );
  });

  it('discards the draft, and asks before closing over unsaved changes', async () => {
    const user = userEvent.setup();
    const { drawer, router } = await openAnaya();
    await user.click(within(drawer).getByRole('button', { name: 'Peel' }));
    await user.click(within(drawer).getByRole('button', { name: 'Discard' }));
    expect(within(drawer).getByRole('button', { name: 'Save lead' })).toBeDisabled();
    await user.click(within(drawer).getByRole('button', { name: 'Peel' }));
    await user.click(screen.getByTestId('lead-drawer-close'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(LEADS));
    expect(router.state.location.search).toMatchObject({ view: 'all' });
    expect(updateLead).not.toHaveBeenCalled();
  });

  it('removes the lead with a reason — one the schema lacks stored as Other — and Undo restores it', async () => {
    const user = userEvent.setup();
    const { router } = await openAnaya();
    await user.click(screen.getByTestId('lead-drawer-remove'));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('radio', { name: 'Spam' }));
    await user.click(within(confirm).getByRole('button', { name: 'Remove lead' }));
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        'Lead #2363 removed · Spam',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
    expect(deleteLead).toHaveBeenCalledExactlyOnceWith({
      leadId: ANAYA.id,
      reason: 'other',
      note: 'Spam',
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(LEADS));
    expect(world.leads.map((lead) => lead.id)).not.toContain(ANAYA.id);

    const [, options] = notifyMock.undo.mock.lastCall ?? [];
    act(() => options.onUndo());
    await waitFor(() =>
      expect(restoreLead).toHaveBeenCalledWith(ANAYA.id, expect.any(String)),
    );
    await waitFor(() => expect(world.leads.map((lead) => lead.id)).toContain(ANAYA.id));
  });

  it('edits the person from the strip’s contact card, saving with the read’s `updated_at`', async () => {
    const user = userEvent.setup();
    const { drawer } = await openAnaya();
    // The strip's own trigger — the chat header carries a contact card too.
    const trigger = within(drawer)
      .getAllByRole('button', { name: /Anaya Desai/ })
      .find((button) => !button.closest('[data-testid="lead-drawer-chat"]'));
    if (!trigger) throw new Error('no contact strip');
    await user.hover(trigger);
    await user.click(await screen.findByTestId('contact-card-edit'));

    const editor = await screen.findByTestId('contact-editor');
    expect(within(editor).getByTestId('contact-editor-id')).toHaveTextContent('#2363');
    await user.clear(within(editor).getByTestId('contact-editor-first-name'));
    await user.click(within(editor).getByTestId('contact-editor-done'));
    // A contact needs its first name: the editor stays.
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a name and a 10-digit mobile');
    expect(updateContact).not.toHaveBeenCalled();

    await user.type(within(editor).getByTestId('contact-editor-first-name'), 'Anya');
    await user.click(within(editor).getByTestId('contact-editor-done'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Contact updated · applies everywhere',
      ),
    );
    expect(updateContact).toHaveBeenCalledExactlyOnceWith({
      contactId: ANAYA.contactId,
      fields: expect.objectContaining({
        firstName: 'Anya',
        lastName: 'Desai',
        phones: [{ phone: '+919879521034', isOnWhatsapp: true }],
      }),
      expectedUpdatedAt: contactRecord().updatedAt,
      idempotencyKey: expect.any(String),
    });
    expect(people.contacts[0]?.name).toBe('Anya Desai');
  });

  it('resizes the chat with the arrow keys in the reading direction, double-click resets', async () => {
    await openAnaya();
    const handle = screen.getByRole('separator', { name: 'Resize panel' });
    expect(handle).toHaveAttribute('aria-valuenow', '420');
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(useDevicePrefsStore.getState().leadChatWidth).toBe(440);
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(useDevicePrefsStore.getState().leadChatWidth).toBe(400);
    fireEvent.doubleClick(handle);
    expect(useDevicePrefsStore.getState().leadChatWidth).toBe(420);
  });

  it('shows one pane at a time on a phone, Chat first', async () => {
    viewport.tier = 'phone';
    renderLeadsRoutes(`${LEADS}/${ANAYA.id}`, LeadsPage);
    const tabs = await screen.findByRole('tablist', { name: 'Lead panels' });
    expect(within(tabs).getByRole('tab', { name: 'Chat' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('lead-drawer-chat')).toBeInTheDocument();
    // No resize handle on a phone: the pane is the screen.
    expect(screen.queryByRole('separator', { name: 'Resize panel' })).toBeNull();
    await userEvent.setup().click(within(tabs).getByRole('tab', { name: 'Details' }));
    expect(
      await screen.findByRole('region', { name: 'Lead details' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('lead-drawer-chat')).toBeNull();
  });

  it('books an appointment from the chat: the form stacks on the lead’s contact, step 1 collapsed', async () => {
    const user = userEvent.setup();
    world.leads = [leadRecord({ interests: ['lhr'] })];
    const { drawer } = await openAnaya();
    const chat = within(drawer).getByTestId('lead-drawer-chat');
    await user.click(await within(chat).findByTestId('chat-book'));
    const booking = await screen.findByTestId('new-appointment-drawer');
    expect(within(booking).getByTestId('new-appointment-drawer-title')).toHaveTextContent(
      'New appointment',
    );
    // Who is the lead's contact, read by its id.
    expect(
      await within(booking).findByTestId('appointment-form-who-card'),
    ).toHaveTextContent('Anaya Desai');
    expect(fetchContact).toHaveBeenLastCalledWith(ANAYA.contactId);
    // A laser interest books LHR Treatment for 20 minutes, today, Date & time open.
    const details = within(booking).getByTestId('appointment-form-details');
    expect(details).toHaveAttribute('data-open', 'false');
    expect(details).toHaveTextContent('LHR Treatment');
    expect(details).toHaveTextContent('20 min');
    expect(within(booking).getByTestId('appointment-form-slot')).toHaveAttribute(
      'data-open',
      'true',
    );
    expect(within(booking).getByTestId('appointment-form-quick-today')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Closing the form leaves the lead open behind it.
    await user.click(within(booking).getByTestId('new-appointment-drawer-close'));
    await waitFor(() =>
      expect(screen.queryByTestId('new-appointment-drawer')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('lead-drawer')).toBeInTheDocument();
  });

  it('books a Consultation for a lead with no laser interest', async () => {
    const user = userEvent.setup();
    const { drawer } = await openAnaya();
    const chat = within(drawer).getByTestId('lead-drawer-chat');
    await user.click(await within(chat).findByTestId('chat-book'));
    const booking = await screen.findByTestId('new-appointment-drawer');
    await within(booking).findByTestId('appointment-form-who-card');
    expect(within(booking).getByTestId('appointment-form-details')).toHaveTextContent(
      'Consultation',
    );
  });

  it('books from Progress: the Appointment scheduled step opens the form on the lead’s contact, locked', async () => {
    const user = userEvent.setup();
    const { drawer } = await openAnaya();
    const step = within(drawer).getByTestId('lead-drawer-step-appointment_scheduled');
    expect(step).toHaveTextContent('Book');
    await user.click(step);
    const booking = await screen.findByTestId('new-appointment-drawer');
    const who = await within(booking).findByTestId('appointment-form-who-card');
    expect(who).toHaveTextContent('Anaya Desai');
    // The person is the lead's: the booking moves this lead, so the card offers no Change.
    await user.hover(within(who).getByRole('button', { name: /Anaya Desai/ }));
    const card = await screen.findByRole('dialog', { name: 'Contact' });
    expect(
      within(card).getByRole('button', { name: 'Edit contact' }),
    ).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Change contact' })).toBeNull();
  });

  it('shows the booking still to happen on Progress — Cancel asks why, Reschedule opens it', async () => {
    const user = userEvent.setup();
    world.leads = [leadRecord({ status: 'appointment_scheduled' })];
    bookings.rows = [
      appointmentRow({
        contactId: ANAYA.contactId,
        leadId: ANAYA.id,
        status: 'cancelled',
      }),
      appointmentRow({
        id: 'appt_anaya0000000000000000',
        contactId: ANAYA.contactId,
        leadId: ANAYA.id,
        startTime: '11:00',
      }),
    ];
    const { drawer } = await openAnaya();
    const booked = await within(drawer).findByRole('region', {
      name: 'Booked appointment',
    });
    expect(booked).toHaveTextContent(/Booked · Tomorrow · 11:00/i);
    expect(booked).toHaveTextContent('Consultation');
    // Booked: the earlier steps wait for the cancel (clinozy-be L11).
    expect(within(drawer).getByTestId('lead-drawer-step-follow_up')).toBeDisabled();

    await user.click(within(booked).getByRole('button', { name: 'Cancel appointment' }));
    expect(await screen.findByText('Cancel this appointment?')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByText('Cancel this appointment?')).not.toBeInTheDocument(),
    );

    await user.click(within(booked).getByRole('button', { name: 'Reschedule' }));
    expect(await screen.findByTestId('appointment-drawer')).toBeInTheDocument();
  });

  it('offers no booking from the chat without the right to book', async () => {
    access.book = false;
    const { drawer } = await openAnaya();
    const chat = within(drawer).getByTestId('lead-drawer-chat');
    await within(chat).findByText(/^Lead created/);
    expect(within(chat).queryByTestId('chat-book')).not.toBeInTheDocument();
    expect(screen.queryByTestId('new-appointment-drawer')).not.toBeInTheDocument();
    expect(
      within(drawer).getByTestId('lead-drawer-step-appointment_scheduled'),
    ).toBeDisabled();
  });

  // QA-07's pattern: a member who reads the stream but may not write it had a composer the server
  // refused.
  it('reads the chat without a composer for a member who may not write it', async () => {
    access.write = false;
    const { drawer } = await openAnaya();
    const chat = within(drawer).getByTestId('lead-drawer-chat');
    await within(chat).findByText(/^Lead created/);
    expect(within(chat).queryByTestId('chat-textarea')).not.toBeInTheDocument();
    expect(within(chat).queryByTestId('chat-send')).not.toBeInTheDocument();
  });

  // Decided with the owner: a member who may not read the person's stream sees no chat at all.
  it('is the details alone for a member who may not read the stream — no chat, no thread read', async () => {
    access.read = false;
    const { drawer } = await openAnaya();
    expect(
      within(drawer).getByRole('region', { name: 'Lead details' }),
    ).toBeInTheDocument();
    expect(within(drawer).queryByTestId('lead-drawer-chat')).not.toBeInTheDocument();
    expect(fetchContactThread).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    const { drawer } = await openAnaya();
    await within(drawer).findByText(/^Lead created/);
    expect(
      await axe(drawer, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
