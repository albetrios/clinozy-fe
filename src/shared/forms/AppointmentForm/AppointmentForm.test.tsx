import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cancelAppointment,
  copyAppointment,
  createAppointment,
  fetchAppointmentSlots,
  moveAppointment,
  updateAppointment,
} from '@/shared/api/app/appointments-api.ts';
import type {
  AppointmentRow,
  AppointmentSlotDay,
} from '@/shared/api/app/appointments-contracts.ts';
import {
  createContact,
  fetchContact,
  updateContact,
} from '@/shared/api/app/contacts-api.ts';
import type { Contact } from '@/shared/api/app/contacts-contracts.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import { CONFIRM_TEST_IDS } from '@/shared/components/ConfirmDialog/index.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useAppointment } from '@/shared/hooks/useAppointments/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import {
  fixtureActiveBranches,
  signInTestMember,
} from '@/tests/utils/app-shell-doubles.ts';
import {
  APPOINTMENT_NOW,
  APPOINTMENT_TODAY,
  APPOINTMENT_TOMORROW,
  appointmentRow,
  contactHit,
  DOCTOR_ARJUN,
  DOCTOR_NISHA,
  slotDay,
} from '@/tests/utils/appointment-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { EMPTY_CONTACT_PROFILE } from '@/tests/utils/contact-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier, width: 1440 }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));
vi.mock('@/shared/hooks/useViewportWidth/index.ts', () => ({
  useViewportWidth: () => viewport.width,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** Whether the member may write to the person's stream (`contact_activity:create`). */
const stream = vi.hoisted(() => ({ reads: true, writes: true }));
vi.mock('@/shared/hooks/useAppAccess/index.ts', () => ({
  useAppAccess: () => ({
    previewRole: null,
    can: () => true,
    canCode: (code: string) =>
      (code !== 'contact_activity:create' || stream.writes) &&
      (code !== 'contact_activity:read' || stream.reads),
    viewableSections: [],
    isResolved: true,
  }),
}));

/**
 * The clinozy-be the form runs against: the bookings, each day's free starts, the people, the
 * person's open lead and the team. Every write changes it, so the refetch shows the write.
 */
const world = vi.hoisted(() => ({
  appointments: [] as AppointmentRow[],
  slots: new Map<string, AppointmentSlotDay>(),
  contacts: [] as Contact[],
  lead: null as LeadRecord | null,
  team: [] as DirectoryMember[],
}));

/** A new booking's id — #2870. */
const BOOKED_ID = 'appt_new000000000000000000';

vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => {
  const { appointmentRow: row, slotDay: day } =
    await import('@/tests/utils/appointment-doubles.ts');
  const { HttpError } = await import('@/shared/errors/HttpError.ts');
  const find = (id: string) => {
    const found = world.appointments.find((entry) => entry.id === id);
    if (!found) throw new HttpError('Not found', 404, `/app/appointments/${id}`, 'GET');
    return found;
  };
  const put = (next: AppointmentRow) => {
    world.appointments = [
      ...world.appointments.filter((entry) => entry.id !== next.id),
      next,
    ];
    return structuredClone(next);
  };
  const change = (id: string, patch: Partial<AppointmentRow>) =>
    put({ ...find(id), ...patch, updatedAt: new Date().toISOString() });
  const booked = (from: Partial<AppointmentRow>) => {
    const contact = world.contacts.find((entry) => entry.id === from.contactId);
    return put(
      row({
        ...from,
        id: 'appt_new000000000000000000',
        seq: 2870,
        person: {
          kind: 'contact',
          contactId: from.contactId ?? '',
          name: contact?.name ?? '',
          phone: contact?.primaryPhone ?? null,
          patientId: null,
          leadId: null,
          contactNumber: contact?.contactNumber ?? null,
        },
        leadId: null,
        doctor: world.team.find((member) => member.id === from.doctorId) ?? null,
        reminder: 'confirm_requested',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
  };
  const statusOf = {
    confirm: 'confirmed',
    'check-in': 'checked_in',
    complete: 'completed',
    'no-show': 'no_show',
    reinstate: 'scheduled',
    'undo-check-in': 'confirmed',
  } as const;
  return {
    ...(await importOriginal<object>()),
    fetchAppointment: vi.fn(async (id: string) => structuredClone(find(id))),
    fetchAppointmentSlots: vi.fn(
      async (params: { date: string }) =>
        world.slots.get(params.date) ??
        day(params.date, ['10:00', '10:30', '11:00', '14:00', '14:30']),
    ),
    createAppointment: vi.fn(
      async ({ input }: { input: Partial<AppointmentRow>; idempotencyKey: string }) =>
        booked(input),
    ),
    copyAppointment: vi.fn(
      async ({
        appointmentId,
        date,
        startTime,
      }: {
        appointmentId: string;
        date: string;
        startTime: string;
        idempotencyKey: string;
      }) => {
        const source = find(appointmentId);
        return booked({ ...source, date, startTime, copiedFromId: source.id });
      },
    ),
    updateAppointment: vi.fn(
      async ({
        appointmentId,
        fields,
      }: {
        appointmentId: string;
        fields: Partial<AppointmentRow>;
        expectedUpdatedAt: string;
        idempotencyKey: string;
      }) => change(appointmentId, fields),
    ),
    moveAppointment: vi.fn(
      async ({
        appointmentId,
        route,
      }: {
        appointmentId: string;
        route: keyof typeof statusOf;
        idempotencyKey: string;
      }) => change(appointmentId, { status: statusOf[route] }),
    ),
    cancelAppointment: vi.fn(
      async ({
        appointmentId,
        cancel,
      }: {
        appointmentId: string;
        cancel: { reason: AppointmentRow['cancelReason']; note: string | null };
        idempotencyKey: string;
      }) =>
        change(appointmentId, {
          status: 'cancelled',
          cancelReason: cancel.reason,
          cancelNote: cancel.note,
        }),
    ),
  };
});

vi.mock('@/shared/api/app/contacts-api.ts', async (importOriginal) => {
  const { HttpError } = await import('@/shared/errors/HttpError.ts');
  const find = (id: string) => {
    const found = world.contacts.find((entry) => entry.id === id);
    if (!found) throw new HttpError('Not found', 404, `/app/contacts/${id}`, 'GET');
    return found;
  };
  return {
    ...(await importOriginal<object>()),
    fetchContact: vi.fn(async (id: string) => structuredClone(find(id))),
    // Recent stays empty here: the who search's own suite covers it.
    fetchRecentContacts: vi.fn(async () => []),
    searchContacts: vi.fn(async (typed: string) =>
      structuredClone(
        world.contacts.filter((entry) =>
          entry.name.toLowerCase().includes(typed.trim().toLowerCase()),
        ),
      ),
    ),
    createContact: vi.fn(
      async ({
        fields,
      }: {
        fields: Pick<Contact, 'firstName' | 'lastName'> & {
          phones: { phone: string }[];
        };
        idempotencyKey: string;
      }) => {
        const [first] = world.contacts;
        if (!first) throw new Error('no contact to model one on');
        const created: Contact = {
          ...first,
          id: 'con_meera0000000000000000',
          contactNumber: 1300,
          firstName: fields.firstName,
          lastName: fields.lastName,
          name: [fields.firstName, fields.lastName].filter(Boolean).join(' '),
          primaryPhone: fields.phones[0]?.phone ?? '',
          openLeadId: null,
        };
        world.contacts = [...world.contacts, created];
        return structuredClone(created);
      },
    ),
    updateContact: vi.fn(
      async ({
        contactId,
        fields,
      }: {
        contactId: string;
        fields: Pick<Contact, 'firstName' | 'lastName'>;
        expectedUpdatedAt: string;
        idempotencyKey: string;
      }) => {
        const next: Contact = {
          ...find(contactId),
          firstName: fields.firstName,
          lastName: fields.lastName,
          name: [fields.firstName, fields.lastName].filter(Boolean).join(' '),
          updatedAt: new Date().toISOString(),
        };
        world.contacts = world.contacts.map((entry) =>
          entry.id === contactId ? next : entry,
        );
        return structuredClone(next);
      },
    ),
  };
});

vi.mock('@/shared/api/app/leads-api.ts', async (importOriginal) => {
  const { HttpError } = await import('@/shared/errors/HttpError.ts');
  return {
    ...(await importOriginal<object>()),
    fetchLead: vi.fn(async (id: string) => {
      if (world.lead?.id !== id) {
        throw new HttpError('Not found', 404, `/app/leads/${id}`, 'GET');
      }
      return structuredClone(world.lead);
    }),
  };
});

vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(async () => structuredClone(world.team)),
  fetchMemberNames: vi.fn(
    async (ids: readonly string[]) =>
      new Map(
        world.team
          .filter((member) => ids.includes(member.id))
          .map((member) => [member.id, member.name]),
      ),
  ),
}));

// The one offerings catalogue — "From offerings" and the chat's offering names: empty here.
vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllOfferings: vi.fn(async () => []),
}));

// The person's chat beside an Edit: a quiet stream.
vi.mock('@/shared/api/app/contact-activities-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchContactThread: vi.fn(async () => ({ thread: null, messages: [], authors: {} })),
  sendContactActivity: vi.fn(),
  resendContactActivity: vi.fn(),
  fetchContactMessagingStatus: vi.fn(async () => ({
    whatsappDown: false,
    isConnected: false,
  })),
  fetchContactTemplateValues: vi.fn(async () => ({
    clinicName: 'Cresence',
    address: '',
    mapsLink: '',
    reviewLink: '',
    freeSlots: [],
  })),
}));

import { APPOINTMENT_FORM_TEST_IDS as IDS } from './appointment-form.constants.ts';
import type { AppointmentFormMode } from './appointment-form-model.ts';
import { AppointmentForm, type AppointmentFormProps } from './AppointmentForm.tsx';

const NEW = IDS.createDrawer;
const EDIT = IDS.drawer;

/** Riya Mehta as `GET /app/contacts/:contact_id` reads her — a lead, no patient file. */
const RIYA: Contact = {
  ...EMPTY_CONTACT_PROFILE,
  ...contactHit(),
  phones: [{ phone: '+919825011241', isPrimary: true, isOnWhatsapp: true }],
};

/** Riya's open lead: #2371, Contacted. */
const RIYA_LEAD: LeadRecord = {
  id: 'lead_riya00000000000000000',
  leadNumber: 2371,
  contactId: RIYA.id,
  person: null,
  name: 'Riya Mehta',
  phone: '+919825011241',
  patientId: null,
  status: 'contacted',
  source: 'instagram',
  interests: ['clinical'],
  kind: 'enquiry',
  retargetReason: null,
  ownerId: DOCTOR_NISHA.id,
  involvedIds: [],
  heldUntil: null,
  followUpAt: null,
  branchId: null,
  notes: null,
  lastActivityAt: null,
  isAwaitingReply: false,
  createdAt: '2026-09-30T10:00:00.000Z',
  updatedAt: '2026-09-30T10:00:00.000Z',
};

/** Riya's booking — #2861, a Scheduled consultation with Dr. Nisha tomorrow at 10:30. */
const BOOKING = appointmentRow();

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

/** A booking's form as the Appointments page opens it: the id first, the booking once read. */
function BookingForm({
  id,
  mode = 'edit',
  ...props
}: { id: string; mode?: AppointmentFormMode } & Partial<AppointmentFormProps>) {
  const { data } = useAppointment(id);
  return (
    <AppointmentForm
      open
      mode={mode}
      appointmentId={id}
      appointment={data}
      onClose={() => undefined}
      {...props}
    />
  );
}

function renderNew(props: Partial<AppointmentFormProps> = {}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const view = renderWithProviders(
    <AppointmentForm open mode="create" onClose={onClose} onSaved={onSaved} {...props} />,
  );
  return { ...view, onSaved, onClose };
}

/** Open a booking in Edit — `world` holds it. */
function renderBooking(
  booking: AppointmentRow,
  props: Partial<AppointmentFormProps> = {},
) {
  world.appointments = [booking];
  const onSaved = vi.fn();
  const onCopy = vi.fn();
  const view = renderWithProviders(
    <BookingForm id={booking.id} onSaved={onSaved} onCopy={onCopy} {...props} />,
  );
  return { ...view, onSaved, onCopy };
}

/** The form once its draft has started. */
async function form(drawer: string) {
  const panel = await screen.findByTestId(drawer);
  await within(panel).findByTestId(IDS.form);
  return panel;
}

/** Opens step 2, Date & time, unless it is the open card already (one card is open at a time). */
function openSlotStep(panel: HTMLElement) {
  if (within(panel).getByTestId(IDS.slot).getAttribute('data-open') === 'true') return;
  act(() => within(panel).getByTestId(IDS.slotToggle).click());
}

/** A free start on the grid, by its time — step 2 opened first. */
async function slotAt(panel: HTMLElement, time: string) {
  openSlotStep(panel);
  return waitFor(() => {
    const slot = within(panel)
      .queryAllByTestId(IDS.slotTime)
      .find((button) => button.getAttribute('data-time') === time);
    if (!slot) throw new Error(`no free start at ${time}`);
    return slot;
  });
}

/** A day of the booking calendar, by its date. */
function calendarDay(calendar: HTMLElement, iso: string): HTMLElement {
  const day = within(calendar)
    .getAllByTestId(IDS.calendarDay)
    .find((button) => button.dataset.day === iso);
  if (!day) throw new Error(`no calendar day ${iso}`);
  return day;
}

/** The fixture world's main branch — what a New booking files under. */
let mainBranchId = '';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  viewport.tier = 'desktop';
  viewport.width = 1440;
  vi.resetAllMocks();
  stream.reads = true;
  stream.writes = true;
  world.appointments = [];
  world.slots = new Map();
  world.contacts = [structuredClone(RIYA)];
  world.lead = structuredClone(RIYA_LEAD);
  world.team = [DOCTOR_NISHA, DOCTOR_ARJUN];
  signInTestMember();
  const [main] = await fixtureActiveBranches();
  mainBranchId = main?.id ?? '';
});
afterEach(() => {
  vi.useRealTimers();
  useOrganizationStore.getState().clearOrganization();
});

describe('AppointmentForm — New (KICKOFF §6.4)', () => {
  it('opens on the person search, step 1 open and the grid on today, "Pick a time" at 50%', async () => {
    renderNew();
    const panel = await form(NEW);
    expect(within(panel).getByTestId(`${NEW}-title`)).toHaveTextContent(
      'New appointment',
    );
    expect(
      within(panel).getByText('Only free slots are offered · past times are locked'),
    ).toBeVisible();
    expect(within(panel).getByTestId(IDS.whoSearch)).toHaveAttribute(
      'placeholder',
      'Search patient or lead by name, phone, ID',
    );
    expect(within(panel).getByTestId(IDS.details)).toHaveAttribute('data-open', 'true');
    // One card open at a time: Date & time waits, collapsed, behind "Next".
    expect(within(panel).getByTestId(IDS.slot)).toHaveAttribute('data-open', 'false');
    expect(within(panel).getByTestId(IDS.slot)).toHaveTextContent('Not filled yet');
    // The first of the team is the doctor until one is picked.
    expect(within(panel).getByTestId(IDS.doctor)).toHaveAccessibleName(/Nisha Shah/);
    const next = within(panel).getByTestId(IDS.detailsNext);
    expect(next).toHaveTextContent('Next: Date & time →');
    act(() => next.click());
    expect(within(panel).getByTestId(IDS.details)).toHaveAttribute('data-open', 'false');
    expect(within(panel).getByTestId(IDS.slot)).toHaveAttribute('data-open', 'true');
    expect(within(panel).getByTestId(`${IDS.quickDate}-today`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const save = within(panel).getByTestId(`${NEW}-save`);
    expect(save).toHaveTextContent('Pick a time');
    expect(save).toHaveAttribute('data-incomplete', 'true');
    expect(save).toBeEnabled();
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('asks for the person first: "Pick who the appointment is for"', async () => {
    const user = setUser();
    renderNew();
    const panel = await form(NEW);
    await user.click(within(panel).getByTestId(`${NEW}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Pick who the appointment is for');
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it('reads the doctor’s free starts for the day at the branch, one row per hour', async () => {
    world.slots.set(
      '2026-10-05',
      slotDay('2026-10-05', ['09:30', '10:00', '10:30', '15:00']),
    );
    renderNew({ prefill: { date: '2026-10-05' } });
    const panel = await form(NEW);
    await slotAt(panel, '15:00');
    expect(fetchAppointmentSlots).toHaveBeenLastCalledWith({
      date: '2026-10-05',
      branchId: mainBranchId,
      doctorId: DOCTOR_NISHA.id,
      durationMin: 20,
      step: 30,
    });
    const hours = within(panel).getAllByTestId(IDS.slotHour);
    expect(hours.map((hour) => within(hour).getAllByTestId(IDS.slotTime).length)).toEqual(
      [1, 2, 1],
    );
    expect(
      within(panel)
        .getAllByTestId(IDS.slotTime)
        .map((slot) => slot.textContent),
    ).toEqual([':30', ':00', ':30', ':00']);
    expect(within(panel).queryByTestId(IDS.slotHint)).not.toBeInTheDocument();
  });

  it('asks the grid again for a new doctor, length or step', async () => {
    const user = setUser();
    renderNew({ prefill: { date: '2026-10-05' } });
    const panel = await form(NEW);
    await slotAt(panel, '10:00');
    // Step 1 again (Date & time folds away), then back to the grid.
    await user.click(within(panel).getByTestId(IDS.detailsToggle));
    await user.click(within(panel).getByTestId(IDS.doctor));
    await user.click(
      await screen.findByTestId(`${IDS.doctor}-option-${DOCTOR_ARJUN.id}`),
    );
    await user.click(within(panel).getByTestId(`${IDS.length}-45`));
    await user.click(within(panel).getByTestId(IDS.detailsNext));
    await user.click(within(within(panel).getByTestId(IDS.slotStep)).getByText('15 min'));
    await waitFor(() =>
      expect(fetchAppointmentSlots).toHaveBeenLastCalledWith({
        date: '2026-10-05',
        branchId: mainBranchId,
        doctorId: DOCTOR_ARJUN.id,
        durationMin: 45,
        step: 15,
      }),
    );
  });

  it('says why a day is closed, in place of the grid', async () => {
    const user = setUser();
    world.slots.set(
      '2026-10-05',
      slotDay('2026-10-05', [], { closedReason: 'holiday', closedLabel: 'Diwali' }),
    );
    world.slots.set(
      '2026-10-06',
      slotDay('2026-10-06', [], { closedReason: 'doctor_off', closedLabel: null }),
    );
    world.slots.set('2026-10-07', slotDay('2026-10-07', []));
    renderNew({ prefill: { date: '2026-10-05' } });
    const panel = await form(NEW);
    openSlotStep(panel);
    const hint = await within(panel).findByTestId(IDS.slotHint);
    await waitFor(() =>
      expect(hint).toHaveTextContent('Closed for Diwali · pick another date'),
    );
    expect(within(panel).queryAllByTestId(IDS.slotTime)).toHaveLength(0);
    const calendar = within(panel).getByTestId(IDS.calendar);
    const day = (iso: string) => calendarDay(calendar, iso);
    await user.click(day('2026-10-06'));
    await waitFor(() =>
      expect(within(panel).getByTestId(IDS.slotHint)).toHaveTextContent(
        'The doctor is off on this day · pick another date or doctor',
      ),
    );
    // An open day with every start taken.
    await user.click(day('2026-10-07'));
    await waitFor(() =>
      expect(within(panel).getByTestId(IDS.slotHint)).toHaveTextContent(
        'No times to book on this day · pick another date',
      ),
    );
  });

  it('picks the day on the month grid: past days off, "‹" off on this month, the pick in sky', async () => {
    const user = setUser();
    renderNew();
    const panel = await form(NEW);
    openSlotStep(panel);
    const calendar = within(panel).getByTestId(IDS.calendar);
    expect(calendar).toHaveAccessibleName('Calendar');
    const day = (iso: string) => calendarDay(calendar, iso);
    expect(day('2026-10-02')).toBeDisabled();
    expect(day(APPOINTMENT_TODAY)).toHaveAttribute('data-day-state', 'selected');
    expect(within(calendar).getByTestId(IDS.calendarPrevious)).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(day('2026-10-09'));
    expect(day('2026-10-09')).toHaveAttribute('data-day-state', 'selected');
    expect(day(APPOINTMENT_TODAY)).toHaveAttribute('data-day-state', 'today');
    expect(within(panel).getByTestId(`${IDS.quickDate}-today`)).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(within(calendar).getByTestId(IDS.calendarNext));
    expect(within(calendar).getByRole('status')).toHaveTextContent('November 2026');
    expect(within(calendar).getByTestId(IDS.calendarPrevious)).not.toHaveAttribute(
      'aria-disabled',
    );
  });

  it('finds a contact, picks a free start and books it: "Book <day>, <time>"', async () => {
    const user = setUser();
    const { onSaved } = renderNew({ prefill: { date: '2026-10-05' } });
    const panel = await form(NEW);
    await user.type(within(panel).getByTestId(IDS.whoSearch), 'Riya');
    await user.click(await within(panel).findByTestId(IDS.whoHit));
    expect(within(panel).getByTestId(IDS.whoCard)).toHaveTextContent('Riya Mehta');
    // Her open lead, as its chip.
    expect(await within(panel).findByTestId(IDS.connectedLead)).toHaveTextContent(
      '#2371 · Contacted',
    );
    await user.click(await slotAt(panel, '10:30'));
    const save = within(panel).getByTestId(`${NEW}-save`);
    // "Book <day>, <time>" — the day and the time each isolated in the label.
    expect(save).toHaveTextContent(`Book ${fsi('Mon, Oct 5')}, ${fsi('10:30 AM')}`);
    expect(save).not.toHaveAttribute('data-incomplete');
    await user.click(save);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(createAppointment).toHaveBeenCalledExactlyOnceWith({
      input: {
        contactId: RIYA.id,
        branchId: mainBranchId,
        doctorId: DOCTOR_NISHA.id,
        type: 'consultation',
        serviceLabel: 'Consultation',
        offeringId: null,
        durationMin: 20,
        date: '2026-10-05',
        startTime: '10:30',
        reason: null,
        notes: null,
      },
      idempotencyKey: expect.any(String),
    });
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({
      kind: 'created',
      appointment: { id: BOOKED_ID, date: '2026-10-05', startTime: '10:30' },
    });
    expect(notifyMock.success).toHaveBeenCalledWith(
      expect.stringMatching(/^Booked #2870 · .* · confirm request queued$/),
    );
  });

  it('creates a contact the search did not find, then books them — the save waits for ten digits', async () => {
    const user = setUser();
    const { onSaved } = renderNew({ prefill: { date: '2026-10-05' } });
    const panel = await form(NEW);
    await user.type(within(panel).getByTestId(IDS.whoSearch), 'Meera Iyer');
    await user.click(await within(panel).findByTestId(IDS.whoCreate));
    // The quick add, its mobile left empty: the card's own field still takes it.
    await user.click(within(panel).getByTestId(`${IDS.who}-quick-add-submit`));
    const card = within(panel).getByTestId(IDS.whoCard);
    expect(card).toHaveTextContent('Meera Iyer');
    expect(card).toHaveTextContent('New contact · add their mobile to book');
    await user.click(await slotAt(panel, '11:00'));
    await user.click(within(panel).getByTestId(`${NEW}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Mobile needs 10 digits');
    expect(createContact).not.toHaveBeenCalled();
    await user.type(within(panel).getByTestId(IDS.whoMobile), '9811122233');
    expect(within(panel).getByTestId(IDS.whoMobile)).toHaveValue('98111 22233');
    await user.click(within(panel).getByTestId(`${NEW}-save`));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(createContact).toHaveBeenCalledExactlyOnceWith({
      fields: expect.objectContaining({
        firstName: 'Meera',
        lastName: 'Iyer',
        phones: [{ phone: '+919811122233', isOnWhatsapp: true }],
      }),
      idempotencyKey: expect.any(String),
    });
    expect(createAppointment).toHaveBeenCalledWith({
      input: expect.objectContaining({
        contactId: 'con_meera0000000000000000',
        startTime: '11:00',
      }),
      idempotencyKey: expect.any(String),
    });
  });

  it('starts from a `who=` contact, read by its id', async () => {
    renderNew({ prefill: { whoId: RIYA.id } });
    const panel = await form(NEW);
    expect(fetchContact).toHaveBeenCalledWith(RIYA.id);
    expect(within(panel).getByTestId(IDS.whoCard)).toHaveTextContent('Riya Mehta');
    expect(within(panel).queryByTestId(IDS.whoSearch)).not.toBeInTheDocument();
  });

  it('ignores a `who=` that names no contact, and opens on the search', async () => {
    renderNew({ prefill: { whoId: RIYA_LEAD.id } });
    const panel = await form(NEW);
    expect(within(panel).getByTestId(IDS.whoSearch)).toBeVisible();
    expect(within(panel).queryByTestId(IDS.whoCard)).not.toBeInTheDocument();
    expect(fetchContact).not.toHaveBeenCalled();
  });

  it('starts step 1 collapsed from the lead chat, with the booking’s service and reason', async () => {
    renderNew({
      prefill: {
        whoId: RIYA.id,
        collapsed: true,
        type: 'treatment',
        serviceLabel: 'LHR Treatment',
        durationMin: 20,
        reason: 'Is laser safe for dark skin?',
      },
    });
    const panel = await form(NEW);
    expect(within(panel).getByTestId(IDS.whoCard)).toHaveTextContent('Riya Mehta');
    const details = within(panel).getByTestId(IDS.details);
    expect(details).toHaveAttribute('data-open', 'false');
    expect(details).toHaveTextContent('LHR Treatment');
    expect(details).toHaveTextContent('Is laser safe for dark skin?');
    expect(within(panel).getByTestId(IDS.slot)).toHaveAttribute('data-open', 'true');
  });

  it('copies a booking: same person and service, today, no time — "Copied" once — and books it as a copy', async () => {
    const user = setUser();
    // Booked at the branch a New form files under, so the copy goes as is.
    const source = appointmentRow({ branchId: mainBranchId });
    world.appointments = [source];
    const { onSaved } = renderNew({ prefill: { copyOf: source.id } });
    const panel = await form(NEW);
    expect(within(panel).getByTestId(IDS.whoCard)).toHaveTextContent('Riya Mehta');
    expect(within(panel).getByTestId(IDS.details)).toHaveTextContent('Consultation');
    expect(within(panel).getByTestId(IDS.details)).toHaveAttribute('data-open', 'false');
    expect(within(panel).getByTestId(`${IDS.quickDate}-today`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(panel).getByTestId(`${NEW}-save`)).toHaveTextContent('Pick a time');
    expect(notifyMock.success).toHaveBeenCalledExactlyOnceWith(
      'Copied · pick a date and time',
    );
    await user.click(await slotAt(panel, '14:00'));
    await user.click(within(panel).getByTestId(`${NEW}-save`));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(copyAppointment).toHaveBeenCalledExactlyOnceWith({
      appointmentId: source.id,
      date: APPOINTMENT_TODAY,
      startTime: '14:00',
      idempotencyKey: expect.any(String),
    });
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it("keeps a copied booking's own branch — its slots and the copy are that branch's", async () => {
    const user = setUser();
    const otherBranchId = 'brn_east0000000000000000';
    const source = appointmentRow({ branchId: otherBranchId });
    world.appointments = [source];
    const { onSaved } = renderNew({ prefill: { copyOf: source.id } });
    const panel = await form(NEW);
    await user.click(await slotAt(panel, '14:00'));
    expect(fetchAppointmentSlots).toHaveBeenLastCalledWith(
      expect.objectContaining({ branchId: otherBranchId }),
    );
    await user.click(within(panel).getByTestId(`${NEW}-save`));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(copyAppointment).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ appointmentId: source.id, startTime: '14:00' }),
    );
    expect(createAppointment).not.toHaveBeenCalled();
  });
});

describe('AppointmentForm — Edit (KICKOFF §6.4)', () => {
  it('opens a booking with its tiles, "Save changes" off until something changes, and the chat', async () => {
    renderBooking(BOOKING);
    const panel = await form(EDIT);
    expect(within(panel).getByTestId(`${EDIT}-title`)).toHaveTextContent(
      'Appointment #2861',
    );
    expect(within(panel).getByTestId(IDS.statusTile('scheduled'))).toHaveAttribute(
      'data-step',
      'current',
    );
    expect(within(panel).getByTestId(IDS.statusTile('confirmed'))).toHaveAttribute(
      'data-step',
      'upcoming',
    );
    // Check-in waits for the visit day.
    expect(within(panel).getByTestId(IDS.statusTile('checked_in'))).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(within(panel).getByTestId(`${EDIT}-save`)).toBeDisabled();
    expect(within(panel).getByTestId(IDS.chat)).toBeInTheDocument();
    expect(await within(panel).findByTestId('chat-textarea')).toBeInTheDocument();
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  // QA-07's pattern: a member who reads the stream but may not write it had a composer the server
  // refused.
  // Decided with the owner: a member who may not read the person's stream sees no chat at all.
  it('opens a booking without the chat for a member who may not read the person’s stream', async () => {
    stream.reads = false;
    renderBooking(BOOKING);
    const panel = await form(EDIT);
    expect(within(panel).getByTestId(`${EDIT}-title`)).toHaveTextContent(
      'Appointment #2861',
    );
    expect(within(panel).queryByTestId(IDS.chat)).not.toBeInTheDocument();
  });

  it('shows the chat without a composer to a member who may not write to the person', async () => {
    stream.writes = false;
    renderBooking(BOOKING);
    const panel = await form(EDIT);
    const chat = within(panel).getByTestId(IDS.chat);
    // The thread is read — its divider is up — and has no composer under it.
    expect(await within(chat).findByTestId('chat-thread-divider')).toBeInTheDocument();
    expect(within(chat).queryByTestId('chat-textarea')).not.toBeInTheDocument();
  });

  it('confirms through the confirm route — no field is sent', async () => {
    const user = setUser();
    const { onSaved } = renderBooking(BOOKING);
    const panel = await form(EDIT);
    await user.click(within(panel).getByTestId(IDS.statusTile('confirmed')));
    expect(within(panel).getByTestId(IDS.statusTile('confirmed'))).toHaveAttribute(
      'data-step',
      'current',
    );
    const save = within(panel).getByTestId(`${EDIT}-save`);
    expect(save).toHaveTextContent('Save changes');
    await user.click(save);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(moveAppointment).toHaveBeenCalledExactlyOnceWith({
      appointmentId: BOOKING.id,
      route: 'confirm',
      idempotencyKey: expect.any(String),
    });
    expect(updateAppointment).not.toHaveBeenCalled();
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({
      kind: 'updated',
      appointment: { id: BOOKING.id, status: 'confirmed' },
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Riya Mehta → Confirmed');
  });

  it('moves a Confirmed booking: the Rescheduled note asks to confirm again, "Move to …" sends the new start', async () => {
    const user = setUser();
    const confirmed = appointmentRow({ status: 'confirmed' });
    // The booking still holds 10:30 — the server lists the other starts.
    world.slots.set(
      APPOINTMENT_TOMORROW,
      slotDay(APPOINTMENT_TOMORROW, ['10:00', '11:00', '11:30']),
    );
    const { onSaved } = renderBooking(confirmed);
    const panel = await form(EDIT);
    await user.click(await slotAt(panel, '11:00'));
    expect(within(panel).getByTestId(IDS.rescheduled)).toHaveTextContent(
      /^Rescheduled · was .* · needs confirming again/,
    );
    expect(within(panel).getByTestId(IDS.statusTile('scheduled'))).toHaveAttribute(
      'data-step',
      'current',
    );
    const save = within(panel).getByTestId(`${EDIT}-save`);
    expect(save).toHaveTextContent(/^Move to /);
    await user.click(save);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(updateAppointment).toHaveBeenCalledExactlyOnceWith({
      appointmentId: confirmed.id,
      fields: { startTime: '11:00' },
      expectedUpdatedAt: confirmed.updatedAt,
      idempotencyKey: expect.any(String),
    });
    // The server sets a moved booking back to Scheduled itself.
    expect(moveAppointment).not.toHaveBeenCalled();
    expect(notifyMock.success).toHaveBeenCalledWith(
      expect.stringMatching(/^#2861 moved to /),
    );
  });

  it('checks a booking in from the tiles on its day — step 1 folds, the save checks in, Undo undoes it', async () => {
    const user = setUser();
    const today = appointmentRow({ date: APPOINTMENT_TODAY, startTime: '09:30' });
    const { onSaved } = renderBooking(today);
    const panel = await form(EDIT);
    expect(within(panel).getByTestId(IDS.details)).toHaveAttribute('data-open', 'true');
    await user.click(within(panel).getByTestId(IDS.statusTile('checked_in')));
    expect(within(panel).getByTestId(IDS.details)).toHaveAttribute('data-open', 'false');
    await user.click(within(panel).getByTestId(`${EDIT}-save`));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(moveAppointment).toHaveBeenCalledExactlyOnceWith({
      appointmentId: today.id,
      route: 'check-in',
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Riya Mehta → Checked in',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
    const [, options] = notifyMock.undo.mock.lastCall ?? [];
    act(() => options.onUndo());
    await waitFor(() =>
      expect(moveAppointment).toHaveBeenLastCalledWith({
        appointmentId: today.id,
        route: 'undo-check-in',
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it('keeps Date & time locked after check-in, with its summary', async () => {
    const user = setUser();
    renderBooking(
      appointmentRow({
        date: APPOINTMENT_TODAY,
        startTime: '08:30',
        status: 'checked_in',
      }),
    );
    const panel = await form(EDIT);
    const slot = within(panel).getByTestId(IDS.slot);
    expect(slot).toHaveAttribute('data-open', 'false');
    expect(slot).toHaveTextContent('locked after check-in');
    expect(within(panel).getByTestId(IDS.details)).toHaveAttribute('data-open', 'false');
    await user.click(within(panel).getByTestId(IDS.slotToggle));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Date & time are locked once the patient is checked in',
    );
    expect(fetchAppointmentSlots).not.toHaveBeenCalled();
  });

  it('cancels the visit with the form’s reasons — its toast’s Undo reinstates it', async () => {
    const user = setUser();
    renderBooking(BOOKING);
    const panel = await form(EDIT);
    await user.click(within(panel).getByTestId(IDS.cancelVisit));
    const confirm = await screen.findByTestId(CONFIRM_TEST_IDS.dialog);
    expect(confirm).toHaveTextContent('Cancel this appointment?');
    await user.click(within(confirm).getByText('Patient cancelled'));
    await user.click(screen.getByTestId(CONFIRM_TEST_IDS.accept));
    await waitFor(() =>
      expect(cancelAppointment).toHaveBeenCalledExactlyOnceWith({
        appointmentId: BOOKING.id,
        cancel: { reason: 'patient_asked', note: null },
        idempotencyKey: expect.any(String),
      }),
    );
    const banner = await within(await form(EDIT)).findByTestId(IDS.cancelled);
    expect(banner).toHaveTextContent('Patient asked · slot released · reminders stopped');
    expect(within(banner).getByTestId(IDS.restore)).toBeEnabled();
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Appointment #2861 cancelled',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
    const [, options] = notifyMock.undo.mock.lastCall ?? [];
    act(() => options.onUndo());
    await waitFor(() =>
      expect(moveAppointment).toHaveBeenCalledWith({
        appointmentId: BOOKING.id,
        route: 'reinstate',
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it('keeps an "Other" reason’s note with the cancel', async () => {
    const user = setUser();
    renderBooking(BOOKING);
    const panel = await form(EDIT);
    await user.click(within(panel).getByTestId(IDS.cancelVisit));
    const confirm = await screen.findByTestId(CONFIRM_TEST_IDS.dialog);
    await user.click(within(confirm).getByText('Other'));
    await user.type(within(confirm).getByTestId(CONFIRM_TEST_IDS.note), 'Moved to Pune');
    await user.click(screen.getByTestId(CONFIRM_TEST_IDS.accept));
    await waitFor(() =>
      expect(cancelAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ cancel: { reason: 'other', note: 'Moved to Pune' } }),
      ),
    );
    expect(await within(await form(EDIT)).findByTestId(IDS.cancelled)).toHaveTextContent(
      'Moved to Pune · slot released · reminders stopped',
    );
  });

  it('restores a cancelled booking while its time is ahead', async () => {
    const user = setUser();
    renderBooking(appointmentRow({ status: 'cancelled', cancelReason: 'unreachable' }));
    const panel = await form(EDIT);
    expect(within(panel).getByTestId(IDS.cancelled)).toHaveTextContent(
      'Could not reach patient · slot released · reminders stopped',
    );
    await user.click(within(panel).getByTestId(IDS.restore));
    await waitFor(() =>
      expect(moveAppointment).toHaveBeenCalledExactlyOnceWith({
        appointmentId: BOOKING.id,
        route: 'reinstate',
        idempotencyKey: expect.any(String),
      }),
    );
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Appointment restored · reminder goes out again',
    );
    // Scheduled again once read back: the banner goes.
    await waitFor(() =>
      expect(within(panel).queryByTestId(IDS.cancelled)).not.toBeInTheDocument(),
    );
  });

  it('opens Reschedule with its title and "Move to …" once a new slot is picked', async () => {
    const user = setUser();
    renderBooking(BOOKING, { mode: 'reschedule' });
    const panel = await form(EDIT);
    expect(within(panel).getByTestId(`${EDIT}-title`)).toHaveTextContent(
      'Reschedule #2861',
    );
    await user.click(await slotAt(panel, '11:00'));
    expect(within(panel).getByTestId(`${EDIT}-save`)).toHaveTextContent(/^Move to /);
  });

  it('reads without Edit: no Copy, no Cancel visit, nothing to save', async () => {
    renderBooking(BOOKING, { readOnly: true });
    const panel = await form(EDIT);
    expect(within(panel).queryByTestId(IDS.copy)).not.toBeInTheDocument();
    expect(within(panel).queryByTestId(IDS.cancelVisit)).not.toBeInTheDocument();
    expect(within(panel).queryByTestId(`${EDIT}-save`)).not.toBeInTheDocument();
    expect(within(panel).getByTestId(IDS.whoCard)).toBeVisible();
  });

  it('saves the person’s name inline on their contact — "applies everywhere"', async () => {
    const user = setUser();
    renderBooking(BOOKING);
    const panel = await form(EDIT);
    const card = within(panel).getByTestId(IDS.whoCard);
    await user.hover(within(card).getAllByRole('button')[0]!);
    const contact = await screen.findByRole('dialog', { name: 'Contact' });
    await user.click(within(contact).getByRole('button', { name: 'Edit contact' }));
    const name = within(panel).getByTestId(IDS.whoEditName);
    await user.clear(name);
    await user.type(name, 'Riya Patel');
    await user.click(within(panel).getByTestId(IDS.whoEditSave));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Contact updated · applies everywhere',
      ),
    );
    expect(updateContact).toHaveBeenCalledExactlyOnceWith({
      contactId: RIYA.id,
      fields: expect.objectContaining({
        firstName: 'Riya',
        lastName: 'Patel',
        phones: [{ phone: '+919825011241', isOnWhatsapp: true }],
      }),
      expectedUpdatedAt: RIYA.updatedAt,
      idempotencyKey: expect.any(String),
    });
    expect(within(panel).getByTestId(IDS.whoCard)).toHaveTextContent('Riya Patel');
  });

  it('hands Copy to the host', async () => {
    const user = setUser();
    const { onCopy } = renderBooking(BOOKING);
    const panel = await form(EDIT);
    await user.click(within(panel).getByTestId(IDS.copy));
    expect(onCopy).toHaveBeenCalledWith(expect.objectContaining({ id: BOOKING.id }));
  });

  it('turns a Copy into a New form itself when the host has none', async () => {
    const user = setUser();
    world.appointments = [BOOKING];
    renderWithProviders(<BookingForm id={BOOKING.id} onCopy={undefined} />);
    const panel = await form(EDIT);
    await user.click(within(panel).getByTestId(IDS.copy));
    const copy = await form(NEW);
    expect(within(copy).getByTestId(`${NEW}-title`)).toHaveTextContent('New appointment');
    expect(within(copy).getByTestId(IDS.whoCard)).toHaveTextContent('Riya Mehta');
  });
});

describe('AppointmentForm — the width (KICKOFF §6.4)', () => {
  it('keeps the drawer inside the window at 820px, so the floating × shows', async () => {
    viewport.width = 820;
    renderBooking(BOOKING);
    const panel = await form(EDIT);
    expect(panel.style.getPropertyValue('--drawer-panel-width')).toBe('764px');
    expect(within(panel).getByTestId(`${EDIT}-close`)).toBeInTheDocument();
  });

  it('drops the chat on a phone', async () => {
    viewport.tier = 'phone';
    viewport.width = 375;
    renderBooking(BOOKING);
    const panel = await form(EDIT);
    expect(within(panel).queryByTestId(IDS.chat)).not.toBeInTheDocument();
  });
});

describe('AppointmentForm — a booking that has to be tried again (WF-01)', () => {
  /** A refusal in clinozy-be's error envelope. */
  const refusal = (path: string, reason: string, detail: string) =>
    new HttpError(detail, 409, path, 'POST', { error: { reason, detail } });

  it('books a new person whose slot was just taken on another slot — as the contact the first try made', async () => {
    const user = setUser();
    const makeContact = vi.mocked(createContact).getMockImplementation();
    if (!makeContact) throw new Error('createContact has no world implementation');
    // clinozy-be: the person's number, sent again, is that contact's now (CT3).
    vi.mocked(createContact)
      .mockImplementationOnce(makeContact)
      .mockRejectedValue(
        refusal(
          '/app/contacts',
          'contact_phone_exists',
          '+919811122233 is already on Meera Iyer (C-1300)',
        ),
      );
    vi.mocked(createAppointment).mockRejectedValueOnce(
      refusal(
        '/app/appointments',
        'slot_taken',
        'The doctor is already booked at this time',
      ),
    );
    const { onSaved } = renderNew({ prefill: { date: '2026-10-05' } });
    const panel = await form(NEW);
    await user.type(within(panel).getByTestId(IDS.whoSearch), 'Meera Iyer');
    await user.click(await within(panel).findByTestId(IDS.whoCreate));
    await user.type(
      within(panel).getByTestId(`${IDS.who}-quick-add-mobile`),
      '9811122233',
    );
    await user.click(within(panel).getByTestId(`${IDS.who}-quick-add-submit`));
    await user.click(await slotAt(panel, '11:00'));
    await user.click(within(panel).getByTestId(`${NEW}-save`));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith('Just taken · pick another slot'),
    );
    // The card is that contact now, not "New contact · add their mobile to book".
    await waitFor(() =>
      expect(within(panel).getByTestId(IDS.whoCard)).not.toHaveTextContent('New contact'),
    );
    await user.click(await slotAt(panel, '14:00'));
    await user.click(within(panel).getByTestId(`${NEW}-save`));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(createContact).toHaveBeenCalledOnce();
    expect(
      vi
        .mocked(createAppointment)
        .mock.calls.map(([vars]) => [vars.input.contactId, vars.input.startTime]),
    ).toEqual([
      ['con_meera0000000000000000', '11:00'],
      ['con_meera0000000000000000', '14:00'],
    ]);
  });
});

describe('AppointmentForm — the grid of a booking being moved (WF-02)', () => {
  it('asks a Reschedule’s grid without the booking itself: its start is offered, and again after another day', async () => {
    const user = setUser();
    // clinozy-be: the booking (10:30, 20 min) blocks 10:15–10:45 — unless it is the one moved.
    vi.mocked(fetchAppointmentSlots).mockImplementation(async (params) =>
      slotDay(
        params.date,
        params.excludeAppointmentId === BOOKING.id
          ? ['10:00', '10:15', '10:30', '10:45', '11:00']
          : ['10:00', '11:00'],
      ),
    );
    renderBooking(BOOKING, { mode: 'reschedule' });
    const panel = await form(EDIT);
    await waitFor(() =>
      expect(fetchAppointmentSlots).toHaveBeenCalledWith(
        expect.objectContaining({ date: BOOKING.date, excludeAppointmentId: BOOKING.id }),
      ),
    );
    expect(await slotAt(panel, '10:30')).toHaveAttribute('aria-checked', 'true');
    await user.click(await slotAt(panel, '10:45')); // overlaps only itself
    expect(within(panel).getByTestId(`${EDIT}-save`)).toHaveTextContent(/^Move to /);
    const calendar = within(panel).getByTestId(IDS.calendar);
    await user.click(calendarDay(calendar, '2026-10-06'));
    await user.click(calendarDay(calendar, BOOKING.date));
    await user.click(await slotAt(panel, '10:30'));
    expect(within(panel).getByTestId(`${EDIT}-save`)).not.toHaveTextContent(
      'Pick a time',
    );
  });

  it('asks a New booking’s grid with no booking left out', async () => {
    renderNew({ prefill: { date: '2026-10-05' } });
    const panel = await form(NEW);
    await slotAt(panel, '11:00');
    expect(
      vi
        .mocked(fetchAppointmentSlots)
        .mock.calls.every(([params]) => params.excludeAppointmentId === undefined),
    ).toBe(true);
  });
});
