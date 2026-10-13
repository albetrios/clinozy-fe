import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as AppointmentsApiModule from '@/shared/api/app/appointments-api.ts';
import {
  cancelAppointment,
  fetchAppointmentDayCounts,
  listAppointments,
  moveAppointment,
} from '@/shared/api/app/appointments-api.ts';
import type { AppointmentListParams } from '@/shared/api/app/appointments-contracts.ts';
import type * as DirectoryApiModule from '@/shared/api/app/directory-api.ts';
import { saveMyPreferences } from '@/shared/api/app/preferences-api.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  APPOINTMENT_NOW,
  dayCount,
  DOCTOR_NISHA,
  TEST_BRANCH_ID,
} from '@/tests/utils/appointment-doubles.ts';

import {
  type AppointmentsWorld,
  deferred,
  KABIR_BOOKING,
  MEERA_BOOKING,
  RIYA_BOOKING,
  seededAppointmentsWorld,
} from '../../__tests__/integration/appointments-test-data.ts';
import {
  grantAppAccess,
  renderAppointmentsRoutes,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { AppointmentActionsProvider } from '../AppointmentActions/index.ts';
import { AgendaDayHeader } from './AgendaDayHeader.tsx';
import { AppointmentsAgenda } from './AppointmentsAgenda.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

const world = vi.hoisted(() => ({}) as AppointmentsWorld);
vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => {
  const { appointmentsApiDouble } =
    await import('../../__tests__/integration/appointments-test-data.ts');
  return {
    ...(await importOriginal<typeof AppointmentsApiModule>()),
    ...appointmentsApiDouble(world),
  };
});
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => {
  const { directoryApiDouble } =
    await import('../../__tests__/integration/appointments-test-data.ts');
  return {
    ...(await importOriginal<typeof DirectoryApiModule>()),
    ...directoryApiDouble(),
  };
});

const PAGE = '/organization/acme/appointments';

function Agenda() {
  return (
    <AppointmentActionsProvider>
      <TooltipProvider>
        <AppointmentsAgenda />
      </TooltipProvider>
    </AppointmentActionsProvider>
  );
}

const rows = () => screen.findAllByTestId('appointments-table-row');

/** The names of the rows on screen, in order (the chip's name, its "Patient" badge aside). */
const rowNames = () =>
  screen
    .getAllByTestId('appointments-table-row')
    .map(
      (row) =>
        row
          .querySelector('[data-slot="person-chip"] > span:last-child > span:first-child')
          ?.textContent?.split(',')[0],
    );

/** The row of a person. */
async function rowOf(name: string): Promise<HTMLElement> {
  await rows();
  const row = screen
    .getAllByTestId('appointments-table-row')
    .find((candidate) => candidate.textContent?.includes(name));
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

/** The Agenda's row of a person, its Change status popover open (once the member's Edit is known). */
async function openStatus(name: string) {
  const user = userEvent.setup();
  renderAppointmentsRoutes(PAGE, Agenda);
  const row = await rowOf(name);
  await user.click(await within(row).findByTestId('appointments-status-button'));
  const popover = await screen.findByTestId('appointments-status-popover');
  return { user, row, popover };
}

/** The params of the last Agenda read. */
const lastListParams = (): AppointmentListParams | undefined =>
  vi.mocked(listAppointments).mock.lastCall?.[0];

/** The window of the last day counts read. */
const lastCountsWindow = () => vi.mocked(fetchAppointmentDayCounts).mock.lastCall?.[0];

/** The `onUndo` the last Undo toast offered. */
function lastUndo(): () => void {
  const options = vi.mocked(notify.undo).mock.lastCall?.[1];
  if (!options?.onUndo) throw new Error('no Undo toast');
  return options.onUndo;
}

beforeEach(() => {
  viewport.tier = 'desktop';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  vi.resetAllMocks();
  Object.assign(world, seededAppointmentsWorld());
  signInTestMember();
  grantAppAccess('owner');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AppointmentsAgenda — the read (KICKOFF §6.4 Agenda)', () => {
  it('reads from today on, Active, in the API’s date-and-start order', async () => {
    renderAppointmentsRoutes(PAGE, Agenda);
    await rows();
    expect(rowNames()).toEqual([
      'Meera Iyer',
      'Kabir Rao',
      'Riya Mehta',
      'Dev Shah',
      'Isha Nair',
    ]);
    expect(lastListParams()).toEqual({
      date: undefined,
      status: 'active',
      doctorId: undefined,
      q: undefined,
      created: undefined,
      branchIds: [],
    });
    expect(vi.mocked(listAppointments).mock.lastCall?.[1]).toBeUndefined();
  });

  it('hands the read the URL’s filters — one doctor — and the header’s branches', async () => {
    await saveMyPreferences({ branchFilter: [TEST_BRANCH_ID] });
    renderAppointmentsRoutes(
      `${PAGE}?status=all&doctor=${DOCTOR_NISHA.id}&q=riya&created=last_7`,
      Agenda,
    );
    await waitFor(() =>
      expect(lastListParams()).toEqual({
        date: undefined,
        status: 'all',
        doctorId: DOCTOR_NISHA.id,
        q: 'riya',
        created: 'last_7',
        branchIds: [TEST_BRANCH_ID],
      }),
    );
    expect(await rows()).toHaveLength(1);
  });

  it('reads the one day picked in Filters, a past day included', async () => {
    renderAppointmentsRoutes(`${PAGE}?date=2026-10-02&status=all`, Agenda);
    await rows();
    expect(lastListParams()?.date).toBe('2026-10-02');
    expect(rowNames()).toEqual(['Omar Khan']);
    expect(screen.getByTestId('appointments-day-group')).toHaveTextContent(
      /^2OctFridayYesterday$/,
    );
    await waitFor(() =>
      expect(lastCountsWindow()).toEqual({
        from: '2026-10-02',
        to: '2026-10-02',
        doctorId: undefined,
        branchIds: [],
      }),
    );
  });

  it('reads the next page by its cursor when the list scrolls to its end', async () => {
    const observers: IntersectionObserverCallback[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          observers.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    world.pageSize = 2;
    renderAppointmentsRoutes(PAGE, Agenda);
    await rows();
    expect(rowNames()).toEqual(['Meera Iyer', 'Kabir Rao']);
    await waitFor(() =>
      expect(lastCountsWindow()).toMatchObject({ from: '2026-10-03', to: '2026-10-03' }),
    );
    act(() => {
      observers.at(-1)?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    await waitFor(() => expect(rowNames()).toHaveLength(4));
    expect(vi.mocked(listAppointments).mock.lastCall?.[1]).toBe('page-2');
    // The day counts widen to the days the new page brought.
    await waitFor(() =>
      expect(lastCountsWindow()).toMatchObject({ from: '2026-10-03', to: '2026-10-04' }),
    );
  });

  it('keeps the rows and toasts "Couldn’t load this list" with Retry when a read fails', async () => {
    vi.mocked(listAppointments).mockRejectedValueOnce(new Error('connection dropped'));
    renderAppointmentsRoutes(PAGE, Agenda);
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(
        'Couldn’t load this list · connection dropped. Showing the last copy.',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Retry' }) }),
      ),
    );
  });
});

describe('AppointmentsAgenda — the day headers', () => {
  it('groups the rows by day under sticky headers, each with its counts from the server', async () => {
    renderAppointmentsRoutes(PAGE, Agenda);
    await rows();
    await waitFor(() =>
      expect(lastCountsWindow()).toEqual({
        from: '2026-10-03',
        to: '2026-10-05',
        doctorId: undefined,
        branchIds: [],
      }),
    );
    const headers = screen.getAllByTestId('appointments-day-group');
    expect(headers).toHaveLength(3);
    // Today: Kabir confirmed, Meera checked in — nobody waiting.
    await waitFor(() =>
      expect(headers[0]).toHaveTextContent(/^3OctTodaySaturday1 confirmed· all set$/),
    );
    // Tomorrow: Riya and Dev are Scheduled — awaiting their reply.
    expect(headers[1]).toHaveTextContent(
      /^4OctTomorrowSunday0 confirmed2 awaiting reply$/,
    );
    expect(headers[2]).toHaveTextContent(/^5OctMondayIn 2 days1 confirmed· all set$/);
    expect(headers[0]?.closest('[role="row"]')?.className).toContain('sticky');
  });

  it('counts the whole day whatever the status, search and created filters say', async () => {
    renderAppointmentsRoutes(`${PAGE}?q=riya&status=all&created=today`, Agenda);
    await rows();
    expect(rowNames()).toEqual(['Riya Mehta']);
    await waitFor(() =>
      expect(lastCountsWindow()).toEqual({
        from: '2026-10-04',
        to: '2026-10-04',
        doctorId: undefined,
        branchIds: [],
      }),
    );
    // One row loaded, but Dev waits for his reply that day too.
    await waitFor(() =>
      expect(screen.getByTestId('appointments-day-group')).toHaveTextContent(
        '2 awaiting reply',
      ),
    );
  });

  it('counts within the doctor and the branches the view keeps to', async () => {
    await saveMyPreferences({ branchFilter: [TEST_BRANCH_ID] });
    renderAppointmentsRoutes(`${PAGE}?doctor=${DOCTOR_NISHA.id}`, Agenda);
    await rows();
    await waitFor(() =>
      expect(lastCountsWindow()).toEqual({
        from: '2026-10-03',
        to: '2026-10-05',
        doctorId: DOCTOR_NISHA.id,
        branchIds: [TEST_BRANCH_ID],
      }),
    );
  });

  it('shows the server’s numbers, never the loaded rows’', async () => {
    world.counts = [dayCount('2026-10-04', { scheduled: 5, confirmed: 3 })];
    renderAppointmentsRoutes(`${PAGE}?date=2026-10-04`, Agenda);
    await rows();
    await waitFor(() =>
      expect(screen.getByTestId('appointments-day-group')).toHaveTextContent(
        /3 confirmed.*5 awaiting reply/,
      ),
    );
  });
});

describe('AppointmentsAgenda — the rows', () => {
  it('edges each row in its status’s dot colour, unlike the ink of other room tables (H:5913)', async () => {
    renderAppointmentsRoutes(PAGE, Agenda);
    const row = await rowOf('Riya Mehta');
    expect(row).toHaveClass('border-s-tone-butter-dot');
    expect(row).not.toHaveClass('border-s-tone-butter-foreground');
  });

  it('shows the columns in the design’s order, the quick view unlabelled, none sortable', async () => {
    renderAppointmentsRoutes(PAGE, Agenda);
    await rows();
    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual([
      'Time',
      'Contact',
      'Service',
      'Appointed to',
      'Latest update',
      'Quick view',
      'Status',
    ]);
    expect(screen.queryByRole('button', { name: /^contact/i })).toBeNull();
  });

  it('names the time, the doctor and the latest update of each booking', async () => {
    renderAppointmentsRoutes(PAGE, Agenda);
    const kabir = await rowOf('Kabir Rao');
    expect(kabir).toHaveTextContent('11:30 AM30 min');
    expect(kabir).toHaveTextContent('Arjun R.');
    expect(kabir).toHaveTextContent('✓ Replied Yes');
    expect(await rowOf('Meera Iyer')).toHaveTextContent('✓ Checked in');
    expect(await rowOf('Dev Shah')).toHaveTextContent('✓ Moved ×2');
    expect(await rowOf('Isha Nair')).toHaveTextContent('✓ Reminder sent');
    const riya = await rowOf('Riya Mehta');
    expect(riya.querySelector('[data-latest-empty]')).toHaveTextContent('—');
  });

  it('opens the booking’s drawer from a row, keeping the page’s params', async () => {
    const user = userEvent.setup();
    const { router } = renderAppointmentsRoutes(`${PAGE}?status=all`, Agenda);
    const [first] = await rows();
    await user.click(within(first as HTMLElement).getByText(/min$/));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${PAGE}/${MEERA_BOOKING.id}`),
    );
    expect(router.state.location.search).toEqual({ status: 'all' });
  });

  it('draws the sky empty state, and "New appointment" opens New appointment', async () => {
    const user = userEvent.setup();
    const { router } = renderAppointmentsRoutes(`${PAGE}?q=zzzz`, Agenda);
    const empty = await screen.findByTestId('appointments-empty');
    expect(empty).toHaveAttribute('data-tone', 'sky');
    expect(
      within(empty).getByRole('heading', { name: 'No appointments here' }),
    ).toBeInTheDocument();
    expect(empty).toHaveTextContent('Bookings for the days you pick show up here.');
    expect(within(empty).getByTestId('empty-state-illustration')).toBeInTheDocument();
    const book = await screen.findByTestId('appointments-book-one');
    expect(book).toHaveAccessibleName('New appointment');
    await user.click(book);
    await waitFor(() => expect(router.state.location.pathname).toBe(`${PAGE}/create`));
    expect(router.state.location.search).toEqual({ q: 'zzzz' });
  });
});

describe('AppointmentsAgenda — Change status', () => {
  it('moves a status through its route at once — optimistic — then "<name> → <status>"', async () => {
    const write = deferred();
    world.hold = write.promise;
    const { popover, user, row } = await openStatus('Riya Mehta');
    expect(popover).toHaveTextContent('Now: Scheduled');
    await user.click(within(popover).getByTestId('appointments-status-option-confirmed'));
    // Shown Confirmed before the server answers.
    await waitFor(() =>
      expect(within(row).getByTestId('appointments-status-button')).toHaveTextContent(
        'Confirmed',
      ),
    );
    expect(moveAppointment).toHaveBeenCalledExactlyOnceWith({
      appointmentId: RIYA_BOOKING.id,
      route: 'confirm',
      idempotencyKey: expect.any(String),
    });
    expect(notify.success).not.toHaveBeenCalled();
    write.resolve();
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Riya Mehta → Confirmed'),
    );
    expect(notify.undo).not.toHaveBeenCalled();
  });

  it('checks a booking in on its day, the toast’s Undo running `undo-check-in`', async () => {
    const { popover, user } = await openStatus('Kabir Rao');
    await user.click(
      within(popover).getByTestId('appointments-status-option-checked_in'),
    );
    await waitFor(() =>
      expect(notify.undo).toHaveBeenCalledWith(
        'Kabir Rao → Checked in',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
    expect(moveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: KABIR_BOOKING.id, route: 'check-in' }),
    );
    lastUndo()();
    await waitFor(() =>
      expect(moveAppointment).toHaveBeenLastCalledWith(
        expect.objectContaining({
          appointmentId: KABIR_BOOKING.id,
          route: 'undo-check-in',
        }),
      ),
    );
  });

  it('keeps a guarded move off with its reason (No show before the start)', async () => {
    const { popover } = await openStatus('Riya Mehta');
    const noShow = within(popover).getByTestId('appointments-status-option-no_show');
    expect(noShow).toHaveAttribute('aria-disabled', 'true');
    expect(noShow).toHaveTextContent('No showAvailable after 10:30 AM on Tomorrow');
  });

  it('cancels with one of the contract’s reasons from the cancel view, Undo reinstating it', async () => {
    const { popover, user } = await openStatus('Riya Mehta');
    await user.click(within(popover).getByTestId('appointments-status-option-cancelled'));
    expect(popover).toHaveTextContent('Why is it cancelled?');
    expect(within(popover).getByRole('group', { name: 'PATIENT' })).toBeInTheDocument();
    expect(within(popover).getByRole('group', { name: 'CLINIC' })).toBeInTheDocument();
    await user.click(
      within(popover).getByTestId('appointments-cancel-reason-patient_asked'),
    );
    await waitFor(() =>
      expect(notify.undo).toHaveBeenCalledWith(
        'Riya Mehta → Cancelled · Patient asked · slot freed, reminders stopped',
        expect.anything(),
      ),
    );
    expect(cancelAppointment).toHaveBeenCalledExactlyOnceWith({
      appointmentId: RIYA_BOOKING.id,
      cancel: { reason: 'patient_asked', note: null },
      idempotencyKey: expect.any(String),
    });
    lastUndo()();
    await waitFor(() =>
      expect(moveAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: RIYA_BOOKING.id, route: 'reinstate' }),
      ),
    );
  });

  it('takes "Other"’s note in the cancel view itself — one ask, no second confirm (L-64)', async () => {
    const { popover, user } = await openStatus('Riya Mehta');
    await user.click(within(popover).getByTestId('appointments-status-option-cancelled'));
    const other = within(popover).getByTestId('appointments-cancel-reason-other');
    await user.click(other);
    expect(other).toHaveAttribute('aria-expanded', 'true');
    const note = within(popover).getByRole('textbox', { name: 'Note' });
    expect(note).toHaveFocus();
    // The red "Cancel" waits for the note the contract requires (S:1154).
    const submit = within(popover).getByTestId('appointments-cancel-submit');
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    await user.click(submit);
    expect(popover).toHaveTextContent('Add a short note for “Other”');
    expect(cancelAppointment).not.toHaveBeenCalled();

    await user.type(note, 'Power cut in the clinic{Enter}');
    await waitFor(() =>
      expect(notify.undo).toHaveBeenCalledWith(
        'Riya Mehta → Cancelled · Other · slot freed, reminders stopped',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
    expect(cancelAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        cancel: { reason: 'other', note: 'Power cut in the clinic' },
      }),
    );
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('appointments-status-popover')).not.toBeInTheDocument();
  });

  it('shows the status alone without Edit, and no "New appointment" without Create', async () => {
    grantAppAccess('none');
    const list = renderAppointmentsRoutes(PAGE, Agenda);
    await rows();
    expect(screen.queryByTestId('appointments-status-button')).toBeNull();
    list.unmount();
    renderAppointmentsRoutes(`${PAGE}?q=zzzz`, Agenda);
    expect(await screen.findByTestId('appointments-empty')).toHaveTextContent(
      'No appointments here',
    );
    expect(screen.queryByTestId('appointments-book-one')).toBeNull();
  });
});

describe('AppointmentsAgenda — tiers', () => {
  it('drops Latest update on a tablet (H:144–147)', async () => {
    viewport.tier = 'tablet';
    renderAppointmentsRoutes(PAGE, Agenda);
    await rows();
    const labels = screen
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(labels).not.toContain('Latest update');
    expect(labels).toHaveLength(6);
  });

  it('re-grids each row on a phone: no header, no quick view (H:120–128)', async () => {
    viewport.tier = 'phone';
    renderAppointmentsRoutes(PAGE, Agenda);
    const [first] = await rows();
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
    expect(screen.queryByTestId('appointments-quick-view')).toBeNull();
    expect(first?.className).toContain('grid-cols-[60px_minmax(0,1fr)_auto]');
    expect(
      await within(first as HTMLElement).findByTestId('appointments-status-button'),
    ).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderAppointmentsRoutes(PAGE, Agenda);
    await rows();
    await screen.findAllByTestId('appointments-status-button');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('AgendaDayHeader (H:5906)', () => {
  it('words a later day and its counts — Confirmed, and Scheduled awaiting a reply — plural-aware', () => {
    render(
      <AgendaDayHeader
        date="2026-10-05"
        today="2026-10-03"
        groupIndex={1}
        counts={dayCount('2026-10-05', { confirmed: 1, scheduled: 3, checked_in: 2 })}
      />,
    );
    const header = screen.getByTestId('appointments-day-group');
    expect(header).toHaveTextContent(/^5OctMondayIn 2 days/);
    expect(header).toHaveTextContent('1 confirmed');
    expect(header).toHaveTextContent('3 awaiting reply');
    expect(header.querySelector('[title]')).toHaveAttribute(
      'title',
      '1 confirmed · 3 waiting for a reply',
    );
    // The rule between the two counts is the `--z200` hairline (H:2036), not `muted-strong`.
    expect(header.querySelector('[data-slot="count-divider"]')).toHaveClass('bg-border');
  });

  it('says "· all set" once nobody is waiting, and dates a past day', () => {
    render(
      <AgendaDayHeader
        date="2026-09-28"
        today="2026-10-03"
        groupIndex={0}
        counts={dayCount('2026-09-28', { confirmed: 2, completed: 4 })}
      />,
    );
    const header = screen.getByTestId('appointments-day-group');
    expect(header).toHaveTextContent('5 days ago');
    expect(header).toHaveTextContent('2 confirmed· all set');
  });

  it('shows no counts for a day with nothing to confirm, or before the counts are in', () => {
    const { unmount } = render(
      <AgendaDayHeader
        date="2026-10-04"
        today="2026-10-03"
        groupIndex={0}
        counts={dayCount('2026-10-04', { checked_in: 1, cancelled: 2 })}
      />,
    );
    expect(screen.getByTestId('appointments-day-group')).toHaveTextContent(
      /^4OctTomorrowSunday$/,
    );
    unmount();
    render(
      <AgendaDayHeader
        date="2026-10-04"
        today="2026-10-03"
        groupIndex={0}
        counts={undefined}
      />,
    );
    expect(screen.getByTestId('appointments-day-group')).toHaveTextContent(
      /^4OctTomorrowSunday$/,
    );
  });
});
