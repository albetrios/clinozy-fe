import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppointmentRecord } from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { CONFIRM_TEST_IDS } from '@/shared/components/ConfirmDialog/index.ts';
import { useAppointment } from '@/shared/hooks/useAppointments/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
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

vi.mock('@/shared/hooks/useUploadQueue/index.ts', () => ({
  useUploadQueue: () => ({ enqueue: vi.fn(() => ({ accepted: 0, skipped: 0 })) }),
}));

import { APPOINTMENT_FORM_TEST_IDS as IDS } from './appointment-form.constants.ts';
import type { AppointmentFormMode } from './appointment-form-model.ts';
import { AppointmentForm, type AppointmentFormProps } from './AppointmentForm.tsx';

const TODAY = '2026-10-03';
const NEW = IDS.createDrawer;
const EDIT = IDS.drawer;

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

/** Every clinic action: the org's owner. */
function grantOwner() {
  useOrganizationStore.setState({
    permissions: ['organization:read', 'organization:delete'] as never,
    permissionsResolved: true,
  });
}

const visit = (seq: number): AppointmentRecord => {
  const found = clinicFixtures.appointments.snapshot((row) => row.seq === seq)[0];
  if (!found) throw new Error(`no appointment #${seq}`);
  return found;
};

/** A booking's form as the Appointments page opens it: the id first, the booking once read. */
function BookingForm({
  seq,
  mode = 'edit',
  ...props
}: { seq: number; mode?: AppointmentFormMode } & Partial<AppointmentFormProps>) {
  const id = ref.appointment(seq);
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

function renderBooking(seq: number, props: Partial<AppointmentFormProps> = {}) {
  const onSaved = vi.fn();
  const onCopy = vi.fn();
  const view = renderWithProviders(
    <BookingForm seq={seq} onSaved={onSaved} onCopy={onCopy} {...props} />,
  );
  return { ...view, onSaved, onCopy };
}

/** The form once its draft has started. */
async function form(drawer: string) {
  const panel = await screen.findByTestId(drawer);
  await within(panel).findByTestId(IDS.form);
  return panel;
}

/** The first free start on the grid. */
async function firstFreeSlot(panel: HTMLElement) {
  await waitFor(() =>
    expect(
      within(panel)
        .queryAllByTestId(IDS.slotTime)
        .some((slot) => !(slot as HTMLButtonElement).disabled),
    ).toBe(true),
  );
  const slot = within(panel)
    .getAllByTestId(IDS.slotTime)
    .find((button) => !(button as HTMLButtonElement).disabled);
  if (!slot) throw new Error('no free slot');
  return slot;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:00')));
  viewport.tier = 'desktop';
  viewport.width = 1440;
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
  grantOwner();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
  useOrganizationStore.getState().clearPermissions();
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
    expect(within(panel).getByTestId(IDS.quickDate('today'))).toHaveAttribute(
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
  });

  it('finds a patient, picks a free slot and books it: "Book <day>, <time>"', async () => {
    const user = setUser();
    const { onSaved } = renderNew({ prefill: { date: '2026-10-05' } });
    const panel = await form(NEW);
    await user.type(within(panel).getByTestId(IDS.whoSearch), 'Priti');
    await user.click(await within(panel).findByRole('button', { name: /Priti Soni/ }));
    expect(within(panel).getByTestId(IDS.whoCard)).toHaveTextContent('Priti Soni');
    const slot = await firstFreeSlot(panel);
    await user.click(slot);
    const save = within(panel).getByTestId(`${NEW}-save`);
    expect(save).toHaveTextContent(/^Book Mon/);
    expect(save).not.toHaveAttribute('data-incomplete');
    await user.click(save);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    const outcome = onSaved.mock.calls[0]?.[0];
    expect(outcome).toMatchObject({
      kind: 'created',
      appointment: {
        date: '2026-10-05',
        startTime: slot.getAttribute('data-time'),
        person: { name: 'Priti Soni' },
      },
    });
  });

  it('creates a contact the search did not find — the save waits for ten digits', async () => {
    const user = setUser();
    renderNew({ prefill: { date: '2026-10-05' } });
    const panel = await form(NEW);
    await user.type(within(panel).getByTestId(IDS.whoSearch), 'Kavya Mehta');
    await user.click(await within(panel).findByTestId(IDS.whoCreate));
    const card = within(panel).getByTestId(IDS.whoCard);
    expect(card).toHaveTextContent('Kavya Mehta');
    expect(card).toHaveTextContent('New contact · add mobile at check-in');
    await user.click(await firstFreeSlot(panel));
    await user.click(within(panel).getByTestId(`${NEW}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Mobile needs 10 digits');
    await user.type(within(panel).getByTestId(IDS.whoMobile), '9811122233');
    expect(within(panel).getByTestId(IDS.whoMobile)).toHaveValue('98111 22233');
  });

  it('starts step 1 collapsed from the lead chat, with the booking’s service and reason', async () => {
    const lead = clinicFixtures.leads.snapshot(
      (row) => !row.isContactThread && row.patientId === null,
    )[0];
    if (!lead) throw new Error('no open lead');
    renderNew({
      prefill: {
        whoId: lead.id,
        collapsed: true,
        type: 'treatment',
        serviceLabel: 'LHR Treatment',
        durationMin: 20,
        reason: 'Is laser safe for dark skin?',
      },
    });
    const panel = await form(NEW);
    expect(within(panel).getByTestId(IDS.whoCard)).toHaveTextContent(lead.name);
    const details = within(panel).getByTestId(IDS.details);
    expect(details).toHaveAttribute('data-open', 'false');
    expect(details).toHaveTextContent('LHR Treatment');
    expect(details).toHaveTextContent('“Is laser safe for dark skin?”');
    expect(within(panel).getByTestId(IDS.slot)).toHaveAttribute('data-open', 'true');
  });

  it('copies a booking: same person and service, today, no time — "Copied" once', async () => {
    renderNew({ prefill: { copyOf: ref.appointment(2859) } });
    const panel = await form(NEW);
    expect(within(panel).getByTestId(IDS.whoCard)).toHaveTextContent('Dharti Galani');
    expect(within(panel).getByTestId(IDS.details)).toHaveTextContent('Peel');
    expect(within(panel).getByTestId(`${NEW}-save`)).toHaveTextContent('Pick a time');
    expect(notifyMock.success).toHaveBeenCalledExactlyOnceWith(
      'Copied · pick a date and time',
    );
  });
});

describe('AppointmentForm — Edit (KICKOFF §6.4)', () => {
  it('opens a booking with its tiles, "Save changes" off until something changes, and the chat', async () => {
    renderBooking(2859);
    const panel = await form(EDIT);
    expect(within(panel).getByTestId(`${EDIT}-title`)).toHaveTextContent(
      'Appointment #2859',
    );
    expect(within(panel).getByTestId(IDS.statusTile('confirmed'))).toHaveAttribute(
      'data-step',
      'current',
    );
    expect(within(panel).getByTestId(IDS.statusTile('scheduled'))).toHaveAttribute(
      'data-step',
      'done',
    );
    expect(within(panel).getByTestId(`${EDIT}-save`)).toBeDisabled();
    expect(within(panel).getByTestId(IDS.chat)).toBeInTheDocument();
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('moves the booking: the Rescheduled note asks to confirm again, "Move to …" saves', async () => {
    const user = setUser();
    const { onSaved } = renderBooking(2859);
    const panel = await form(EDIT);
    const current = visit(2859).startTime;
    await waitFor(() =>
      expect(
        within(panel)
          .getAllByTestId(IDS.slotTime)
          .some(
            (slot) =>
              !(slot as HTMLButtonElement).disabled &&
              slot.getAttribute('data-time') !== current,
          ),
      ).toBe(true),
    );
    const other = within(panel)
      .getAllByTestId(IDS.slotTime)
      .find(
        (slot) =>
          !(slot as HTMLButtonElement).disabled &&
          slot.getAttribute('data-time') !== current,
      );
    if (!other) throw new Error('no other slot');
    await user.click(other);
    expect(within(panel).getByTestId(IDS.rescheduled)).toHaveTextContent(
      /needs confirming again/,
    );
    expect(within(panel).getByTestId(IDS.statusTile('scheduled'))).toHaveAttribute(
      'data-step',
      'current',
    );
    const save = within(panel).getByTestId(`${EDIT}-save`);
    expect(save).toHaveTextContent(/^Move to /);
    await user.click(save);
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({
      kind: 'updated',
      appointment: { startTime: other.getAttribute('data-time'), status: 'scheduled' },
    });
  });

  it('cancels the visit with the form’s reasons, then offers Restore', async () => {
    const user = setUser();
    renderBooking(2859);
    const panel = await form(EDIT);
    await user.click(within(panel).getByTestId(IDS.cancelVisit));
    const confirm = await screen.findByTestId(CONFIRM_TEST_IDS.dialog);
    expect(confirm).toHaveTextContent('Cancel this appointment?');
    expect(confirm).toHaveTextContent('Patient cancelled');
    await user.click(within(confirm).getByText('Patient cancelled'));
    await user.click(screen.getByTestId(CONFIRM_TEST_IDS.accept));
    const banner = await within(await form(EDIT)).findByTestId(IDS.cancelled);
    expect(banner).toHaveTextContent('Patient asked · slot released · reminders stopped');
    expect(within(banner).getByTestId(IDS.restore)).toBeEnabled();
    expect(visit(2859).status).toBe('cancelled');
  });

  it('opens Reschedule with its title and "Move to …" once a new slot is picked', async () => {
    const user = setUser();
    renderBooking(2859, { mode: 'reschedule' });
    const panel = await form(EDIT);
    expect(within(panel).getByTestId(`${EDIT}-title`)).toHaveTextContent(
      'Reschedule #2859',
    );
    await user.click(await firstFreeSlot(panel));
    expect(within(panel).getByTestId(`${EDIT}-save`)).toHaveTextContent(/^Move to /);
  });

  it('reads without Edit: no Copy, no Cancel visit, nothing to save', async () => {
    renderBooking(2859, { readOnly: true });
    const panel = await form(EDIT);
    expect(within(panel).queryByTestId(IDS.copy)).not.toBeInTheDocument();
    expect(within(panel).queryByTestId(IDS.cancelVisit)).not.toBeInTheDocument();
    expect(within(panel).queryByTestId(`${EDIT}-save`)).not.toBeInTheDocument();
    expect(within(panel).getByTestId(IDS.whoCard)).toBeVisible();
  });

  it('hands Copy to the host', async () => {
    const user = setUser();
    const { onCopy } = renderBooking(2859);
    const panel = await form(EDIT);
    await user.click(within(panel).getByTestId(IDS.copy));
    expect(onCopy).toHaveBeenCalledWith(expect.objectContaining({ seq: 2859 }));
  });

  it('turns a Copy into a New form itself when the host has none', async () => {
    const user = setUser();
    renderWithProviders(
      <BookingForm seq={2859} onCopy={undefined} onClose={() => undefined} />,
    );
    const panel = await form(EDIT);
    await user.click(within(panel).getByTestId(IDS.copy));
    const copy = await form(NEW);
    expect(within(copy).getByTestId(`${NEW}-title`)).toHaveTextContent('New appointment');
    expect(within(copy).getByTestId(IDS.whoCard)).toHaveTextContent('Dharti Galani');
  });
});

describe('AppointmentForm — after the person (H:2795–2826)', () => {
  it('asks a lead’s visit for a patient record — step 3 stacks the New patient form', async () => {
    const user = setUser();
    const booking = clinicFixtures.appointments.snapshot(
      (row) => row.patientId === null && row.status === 'scheduled' && row.date >= TODAY,
    )[0];
    if (!booking) throw new Error('no lead booking');
    renderBooking(booking.seq);
    const panel = await form(EDIT);
    const card = within(panel).getByTestId(IDS.notPatient);
    expect(card).toHaveTextContent('Not a patient yet');
    await user.click(within(card).getByTestId(IDS.createPatient));
    expect(await screen.findByTestId('patient-quick-add')).toBeInTheDocument();
  });

  it('locks a patient’s photos until check-in — "Check in now" checks them in', async () => {
    const user = setUser();
    const today = clinicFixtures.appointments.snapshot(
      (row) =>
        row.patientId !== null &&
        row.date === TODAY &&
        (row.status === 'scheduled' || row.status === 'confirmed'),
    )[0];
    if (!today) throw new Error('no patient visit today');
    renderBooking(today.seq);
    const panel = await form(EDIT);
    const photos = within(panel).getByTestId(IDS.photos);
    expect(photos).toHaveTextContent(
      'Photos open once the patient is at the clinic · check them in first',
    );
    await user.click(within(photos).getByTestId(IDS.photosCheckIn));
    await waitFor(() => expect(visit(today.seq).status).toBe('checked_in'));
    expect(
      await within(await form(EDIT)).findByTestId(IDS.photosUpload),
    ).toBeInTheDocument();
  });

  it('keeps Date & time locked after check-in, with its summary', async () => {
    const user = setUser();
    const inClinic = clinicFixtures.appointments.snapshot(
      (row) => row.patientId !== null && row.status === 'checked_in',
    )[0];
    if (!inClinic) throw new Error('no checked-in visit');
    renderBooking(inClinic.seq);
    const panel = await form(EDIT);
    const slot = within(panel).getByTestId(IDS.slot);
    expect(slot).toHaveAttribute('data-open', 'false');
    expect(slot).toHaveTextContent('locked after check-in');
    expect(within(panel).getByTestId(IDS.details)).toHaveAttribute('data-open', 'false');
    await user.click(within(panel).getByTestId(IDS.slotToggle));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Date & time are locked once the patient is checked in',
    );
  });
});

describe('AppointmentForm — the width (KICKOFF §6.4)', () => {
  it('keeps the drawer inside the window at 820px, so the floating × shows', async () => {
    viewport.width = 820;
    renderBooking(2859);
    const panel = await form(EDIT);
    expect(panel.style.getPropertyValue('--drawer-panel-width')).toBe('764px');
    expect(within(panel).getByTestId(`${EDIT}-close`)).toBeInTheDocument();
  });

  it('drops the chat on a phone', async () => {
    viewport.tier = 'phone';
    viewport.width = 375;
    renderBooking(2859);
    const panel = await form(EDIT);
    expect(within(panel).queryByTestId(IDS.chat)).not.toBeInTheDocument();
  });
});
