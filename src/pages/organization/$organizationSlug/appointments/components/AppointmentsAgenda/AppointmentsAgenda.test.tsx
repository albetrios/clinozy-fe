import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  grantClinicAccess,
  renderAppointmentsRoutes,
} from '../../__tests__/integration/appointments-test-router.tsx';
import { AppointmentActionsProvider } from '../AppointmentActions/index.ts';
import { AgendaDayHeader } from './AgendaDayHeader.tsx';
import { AppointmentsAgenda } from './AppointmentsAgenda.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
  UNDO_TOAST_DURATION_MS: 10_000,
}));

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

/** The first row whose Status button reads `status`. */
async function rowWithStatus(status: string): Promise<HTMLElement> {
  const all = await rows();
  const row = all.find((candidate) =>
    within(candidate)
      .queryByTestId('appointments-status-button')
      ?.textContent?.includes(status),
  );
  if (!row) throw new Error(`no ${status} row`);
  return row;
}

beforeEach(() => {
  viewport.tier = 'desktop';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  for (const spy of Object.values(notifyMock)) spy.mockReset();
  resetClinicFixtures();
  grantClinicAccess('owner');
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('AppointmentsAgenda (KICKOFF §6.4 Agenda)', () => {
  it('groups the rows by day under sticky headers with the day’s counts', async () => {
    renderAppointmentsRoutes(PAGE, Agenda);
    await rows();
    const headers = screen.getAllByTestId('appointments-day-group');
    expect(headers.length).toBeGreaterThan(1);
    expect(headers[0]).toHaveTextContent(/^3OctTodaySaturday/);
    expect(headers[0]).toHaveTextContent(/confirmed/);
    expect(headers[1]).toHaveTextContent(/TomorrowSunday/);
    expect(headers[0]?.closest('[role="row"]')?.className).toContain('sticky');
  });

  it('edges each row in its status’s dot colour, unlike the ink of other room tables (H:5913)', async () => {
    renderAppointmentsRoutes(PAGE, Agenda);
    const row = await rowWithStatus('Scheduled');
    expect(row).toHaveClass('border-s-tone-butter-dot');
    expect(row).not.toHaveClass('border-s-tone-butter-foreground');
  });

  it('shows the columns in the design’s order, the quick view unlabelled', async () => {
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
  });

  it('opens the booking’s drawer from a row, keeping the page’s params', async () => {
    const user = userEvent.setup();
    const { router } = renderAppointmentsRoutes(`${PAGE}?status=all`, Agenda);
    const [first] = await rows();
    await user.click(within(first as HTMLElement).getByText(/min$/));
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/\/appointments\/[\da-f-]{36}$/),
    );
    expect(router.state.location.search).toEqual({ status: 'all' });
  });

  it('sorts inside each day through the URL: ascending, descending, off', async () => {
    const user = userEvent.setup();
    const { router } = renderAppointmentsRoutes(PAGE, Agenda);
    await rows();
    const contact = screen.getByRole('button', { name: /^contact/i });
    await user.click(contact);
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ sort: 'contact:asc' }),
    );
    await user.click(screen.getByRole('button', { name: /^contact/i }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ sort: 'contact:desc' }),
    );
    await user.click(screen.getByRole('button', { name: /^contact/i }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it('says "No appointments here · book one", and "book one" opens New appointment', async () => {
    const user = userEvent.setup();
    const { router } = renderAppointmentsRoutes(`${PAGE}?q=zzzz`, Agenda);
    const empty = await screen.findByTestId('appointments-empty');
    expect(empty).toHaveTextContent('No appointments here · book one');
    await user.click(screen.getByTestId('appointments-book-one'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${PAGE}/create`));
  });

  it('moves a status from the popover: optimistic, with "<name> → <status>" and Undo', async () => {
    const user = userEvent.setup();
    renderAppointmentsRoutes(PAGE, Agenda);
    const row = await rowWithStatus('Scheduled');
    await user.click(within(row).getByTestId('appointments-status-button'));
    const popover = await screen.findByTestId('appointments-status-popover');
    expect(popover).toHaveTextContent('Now: Scheduled');
    await user.click(within(popover).getByTestId('appointments-status-option-confirmed'));
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        expect.stringMatching(/^\S.* → Confirmed · reminder queued$/),
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
  });

  it('keeps a guarded move off with its reason (No show before the start)', async () => {
    const user = userEvent.setup();
    renderAppointmentsRoutes(PAGE, Agenda);
    const row = await rowWithStatus('Scheduled');
    await user.click(within(row).getByTestId('appointments-status-button'));
    const noShow = within(
      await screen.findByTestId('appointments-status-popover'),
    ).getByTestId('appointments-status-option-no_show');
    expect(noShow).toHaveAttribute('aria-disabled', 'true');
    expect(noShow).toHaveTextContent(/^No showAvailable after .+ on .+$/);
  });

  it('cancels with one of the contract’s reasons from the cancel view', async () => {
    const user = userEvent.setup();
    renderAppointmentsRoutes(PAGE, Agenda);
    const row = await rowWithStatus('Scheduled');
    await user.click(within(row).getByTestId('appointments-status-button'));
    const popover = await screen.findByTestId('appointments-status-popover');
    await user.click(within(popover).getByTestId('appointments-status-option-cancelled'));
    expect(popover).toHaveTextContent('Why is it cancelled?');
    expect(within(popover).getByRole('group', { name: 'PATIENT' })).toBeInTheDocument();
    expect(within(popover).getByRole('group', { name: 'CLINIC' })).toBeInTheDocument();
    await user.click(
      within(popover).getByTestId('appointments-cancel-reason-patient_asked'),
    );
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        expect.stringMatching(
          / → Cancelled · Patient asked · slot freed, reminders stopped$/,
        ),
        expect.anything(),
      ),
    );
  });

  it('takes "Other"’s note in the cancel view itself — one ask, no second confirm (L-64)', async () => {
    const user = userEvent.setup();
    renderAppointmentsRoutes(PAGE, Agenda);
    const row = await rowWithStatus('Scheduled');
    await user.click(within(row).getByTestId('appointments-status-button'));
    const popover = await screen.findByTestId('appointments-status-popover');
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
    expect(notifyMock.undo).not.toHaveBeenCalled();

    await user.type(note, 'Power cut in the clinic{Enter}');
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        expect.stringMatching(/ → Cancelled · Other · slot freed, reminders stopped$/),
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('appointments-status-popover')).not.toBeInTheDocument();
    expect(
      clinicFixtures.appointments.snapshot(
        (visit) =>
          visit.cancelReason === 'other' &&
          visit.cancelNote === 'Power cut in the clinic',
      ),
    ).toHaveLength(1);
  });

  it('hides the Status button without Edit, showing the status alone', async () => {
    grantClinicAccess('none');
    renderAppointmentsRoutes(PAGE, Agenda);
    await rows();
    expect(screen.queryByTestId('appointments-status-button')).toBeNull();
    expect(screen.queryByTestId('appointments-book-one')).toBeNull();
  });

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
      within(first as HTMLElement).getByTestId('appointments-status-button'),
    ).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderAppointmentsRoutes(PAGE, Agenda);
    await rows();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('AgendaDayHeader (H:5906)', () => {
  it('words a later day and its counts, each count plural-aware', () => {
    render(
      <AgendaDayHeader
        date="2026-10-05"
        today="2026-10-03"
        groupIndex={1}
        summary={{ date: '2026-10-05', total: 4, confirmed: 1, scheduled: 3 }}
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
        summary={{ date: '2026-09-28', total: 2, confirmed: 2, scheduled: 0 }}
      />,
    );
    const header = screen.getByTestId('appointments-day-group');
    expect(header).toHaveTextContent('5 days ago');
    expect(header).toHaveTextContent('2 confirmed· all set');
  });

  it('shows no counts for a day with nothing to confirm', () => {
    render(
      <AgendaDayHeader
        date="2026-10-04"
        today="2026-10-03"
        groupIndex={0}
        summary={{ date: '2026-10-04', total: 1, confirmed: 0, scheduled: 0 }}
      />,
    );
    expect(screen.getByTestId('appointments-day-group')).toHaveTextContent(
      /^4OctTomorrowSunday$/,
    );
  });
});
