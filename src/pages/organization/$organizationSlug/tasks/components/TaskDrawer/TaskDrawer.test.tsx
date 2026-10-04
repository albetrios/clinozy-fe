import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import type * as NotifyModule from '@/shared/notify/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderTasksRoutes,
  resetTasksRoutes,
} from '../../__tests__/integration/tasks-test-router.tsx';
import { TasksPage } from '../../TasksPage.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof NotifyModule>()),
  notify: notifyMock,
}));
const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const TASKS = '/organization/acme/tasks';
/** The first drawer of a run loads the fixture world and the chat column's modules. */
const OPEN_MS = 5_000;
const PRITI = ref.task('k1');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  viewport.tier = 'desktop';
  for (const mock of Object.values(notifyMock)) mock.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetTasksRoutes();
  resetClinicFixtures();
  vi.useRealTimers();
});

const drawer = () => screen.getByTestId('task-drawer');
const rowTitles = () =>
  screen
    .queryAllByTestId('tasks-row')
    .map((row) => row.querySelector('.text-field')?.textContent ?? '');

/** Open the list, then a task's drawer from its row. */
async function openTaskTitled(title: string, url = `${TASKS}?scope=everyone`) {
  const user = userEvent.setup();
  const view = renderTasksRoutes(url, TasksPage);
  await waitFor(() => expect(rowTitles()).toContain(title));
  const row = screen
    .getAllByTestId('tasks-row')
    .find((candidate) => candidate.textContent?.includes(title));
  await user.click(within(row as HTMLElement).getByText(title));
  await screen.findByTestId('task-drawer-title', {}, { timeout: OPEN_MS });
  return { ...view, user };
}

const undoToast = (index = 0) =>
  notifyMock.undo.mock.calls[index] as [string, { onUndo: () => void }];

describe('TaskDrawer (KICKOFF §6.10 Task drawer)', () => {
  it('opens a visit task: header, who, What, the visit’s tiles, How and its outcomes', async () => {
    renderTasksRoutes(`${TASKS}/${PRITI}`, TasksPage);
    const title = await screen.findByTestId(
      'task-drawer-title',
      {},
      { timeout: OPEN_MS },
    );
    expect(title).toHaveTextContent('Confirm Priti’s visit');
    expect(drawer()).toHaveClass('md:w-(--task-total)');
    expect(drawer()).toHaveStyle({ '--task-total': '900px', '--task-chat-w': '420px' });
    expect(drawer()).toHaveAccessibleDescription(
      expect.stringContaining(`Created by ${PRODUCT_NAME} · `),
    );
    expect(screen.getByTestId('task-drawer-owner')).toHaveTextContent('Riya S.');
    expect(screen.getByTestId('task-drawer-source')).toHaveTextContent(
      'Open appointment · Appt #2848',
    );
    const tiles = screen.getByTestId('task-drawer-tiles');
    for (const label of ['Visit', 'Service', 'Doctor', 'Status']) {
      expect(within(tiles).getByText(label)).toBeInTheDocument();
    }
    expect(
      within(screen.getByTestId('task-drawer-how')).getAllByRole('listitem'),
    ).toHaveLength(3);
    expect(screen.getByTestId('task-drawer-outcome-confirmedOnCall')).toHaveClass(
      'bg-primary',
    );
    expect(screen.getByTestId('task-drawer-chat')).toBeInTheDocument();
    expect(await axeForDialog(drawer())).toHaveNoViolations();
  });

  it('closes with an outcome, toasts it with Undo and asks what’s next', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(`${TASKS}/${PRITI}`, TasksPage);
    await screen.findByTestId('task-drawer-title', {}, { timeout: OPEN_MS });
    await user.type(screen.getByTestId('task-drawer-note'), 'Spoke to her mother');
    await user.click(screen.getByTestId('task-drawer-outcome-confirmedOnCall'));

    await waitFor(() => expect(router.state.location.pathname).toBe(TASKS));
    const [message] = undoToast();
    expect(message).toMatch(/^Confirm Priti’s visit · .*Spoke to her mother$/);
    const next = await screen.findByTestId('whats-next-drawer');
    expect(
      within(next).getByRole('heading', { name: 'What’s next for Priti?' }),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId('whats-next-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Pick the next step');
    await user.click(screen.getByTestId('whats-next-step-callAgain'));
    await user.click(screen.getByTestId('whats-next-when-tomorrow'));
    await user.click(screen.getByTestId('whats-next-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Next task set · Call again · tomorrow 11 am',
      ),
    );
    await waitFor(() => expect(screen.queryByTestId('whats-next-drawer')).toBeNull());
    await waitFor(() => expect(rowTitles()).toContain('Call again · Priti'));
  });

  it('snoozes from the footer and leaves the drawer', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(`${TASKS}/${PRITI}`, TasksPage);
    await screen.findByTestId('task-drawer-title', {}, { timeout: OPEN_MS });
    await user.click(screen.getByText('Snooze'));
    await user.click(await screen.findByRole('option', { name: '3 hours' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(TASKS));
    expect(undoToast()[0]).toBe('Snoozed · 3 hours');
    await waitFor(() => expect(rowTitles()).not.toContain('Confirm Priti’s visit'));
    undoToast()[1].onUndo();
    await waitFor(() => expect(rowTitles()).toContain('Confirm Priti’s visit'));
  });

  it('moves a task to someone else and stays open, the previous owner named', async () => {
    const user = userEvent.setup();
    renderTasksRoutes(`${TASKS}/${PRITI}`, TasksPage);
    await screen.findByTestId('task-drawer-title', {}, { timeout: OPEN_MS });
    await user.click(
      screen.getByTitle(
        'Move this task to someone else · the previous person stays on it',
      ),
    );
    await user.click(await screen.findByRole('option', { name: /Nidhi/ }));
    await waitFor(() =>
      expect(undoToast()[0]).toMatch(
        /^Confirm Priti’s visit → Nidhi .* · Riya stays on it$/,
      ),
    );
    expect(drawer()).toBeInTheDocument();
    expect(await screen.findByTestId('task-drawer-was')).toHaveTextContent('Was Riya S.');
  });

  it('opens a booking for a rebook — the Appointments room keeps Tasks behind it', async () => {
    const { router, user } = await openTaskTitled('Rebook Vikram');
    await user.click(screen.getByTestId('task-drawer-outcome-rebooked'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/organization/acme/appointments/create',
      ),
    );
    expect(router.state.location.search).toMatchObject({ source: 'task', from: 'tasks' });
    expect(undoToast()[0]).toMatch(/^Rebook Vikram · /);
  });

  it('hands a reply to the product, which closes it', async () => {
    const { router, user } = await openTaskTitled('Reply to Rhea');
    expect(screen.getByTestId('task-drawer-source')).toHaveTextContent(
      /^Open lead · Lead #/,
    );
    expect(
      within(screen.getByTestId('task-drawer-tiles')).getByText('Source'),
    ).toBeVisible();
    await user.click(screen.getByTestId('task-drawer-automation-action'));
    await waitFor(() => expect(router.state.location.pathname).toBe(TASKS));
    expect(undoToast()[0]).toMatch(
      new RegExp(`^${PRODUCT_NAME} is on it · send the first reply`),
    );
  });

  it('shows the task column alone on a phone', async () => {
    viewport.tier = 'phone';
    renderTasksRoutes(`${TASKS}/${PRITI}`, TasksPage);
    await screen.findByTestId('task-drawer-title', {}, { timeout: OPEN_MS });
    expect(screen.queryByTestId('task-drawer-chat')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0);
  });

  it('claims a lead: the toast names the owner who stays, and nothing asks what’s next', async () => {
    const { router, user } = await openTaskTitled('Claim or leave Poonam');
    await user.click(screen.getByTestId('task-drawer-outcome-claimIt'));
    await waitFor(() => expect(router.state.location.pathname).toBe(TASKS));
    expect(undoToast()[0]).toMatch(/^You now own Poonam .* · .+ stays involved$/);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.queryByTestId('whats-next-drawer')).toBeNull();
  });

  it('reads a treatment’s tiles for an aftercare call', async () => {
    await openTaskTitled('Next-day call · Varun');
    const tiles = screen.getByTestId('task-drawer-tiles');
    for (const label of ['Treatment', 'Done on', 'Session', 'Therapist']) {
      expect(within(tiles).getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByTestId('task-drawer-source')).toHaveTextContent(
      /^Open patient · /,
    );
  });
});
