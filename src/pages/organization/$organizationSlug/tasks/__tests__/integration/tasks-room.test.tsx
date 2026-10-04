import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as TasksApiModule from '@/shared/api/clinic/tasks-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import { TasksPage } from '../../TasksPage.tsx';
import { renderTasksRoutes, resetTasksRoutes } from './tasks-test-router.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
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
}));

/** Fails the list read while `failing` is set — the room's list error. */
const listGate = vi.hoisted(() => ({ failing: false }));
vi.mock('@/shared/api/clinic/tasks-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof TasksApiModule>();
  return {
    ...actual,
    fetchTaskPage: async (...args: Parameters<typeof actual.fetchTaskPage>) => {
      if (listGate.failing) throw new Error('connection dropped');
      return actual.fetchTaskPage(...args);
    },
  };
});

const TASKS = '/organization/acme/tasks';

const rows = () => screen.queryAllByTestId('tasks-row');
const titles = () =>
  rows().map((row) => row.querySelector('.text-field')?.textContent ?? '');
const rowOf = (title: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(title));
  if (!row) throw new Error(`no row for ${title}`);
  return row;
};

beforeEach(() => {
  // The seeded tasks are dated from the clock: pin it, so the groups hold on any day.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  viewport.tier = 'desktop';
  listGate.failing = false;
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetTasksRoutes();
  resetClinicFixtures();
  vi.useRealTimers();
});

describe('the Tasks room (KICKOFF §6.10)', () => {
  it('lists my To do and the unowned tasks, grouped by due time', async () => {
    const { container } = renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    // Riya's (the fixture viewer's) seeded tasks; Kabir's call is Nidhi's.
    expect(titles()).toContain('Collect ₹1,200 from Rhea');
    expect(titles()).not.toContain('Call Kabir back');
    const table = screen.getByRole('table', { name: 'To do' });
    const groups = within(table)
      .getAllByRole('rowgroup')
      .map((group) => group.dataset.testid);
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(['tasks-group-overdue', 'tasks-group-today', 'tasks-group-later']).toContain(
        group,
      );
    }
    expect(await axe(container)).toHaveNoViolations();
  });

  it('widens to every owner with "Everyone"', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    await user.click(screen.getByTestId('tasks-scope-tab-everyone'));
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ scope: 'everyone' }),
    );
    await waitFor(() => expect(titles()).toContain('Call Kabir back'));
  });

  it('switches to Snoozed through the URL; an empty view keeps its header and line', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(screen.getByTestId('tasks-tab-snoozed'));
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ tab: 'snoozed' }),
    );
    const group = await screen.findByTestId('tasks-group-snoozed');
    expect(within(group).getByTestId('tasks-empty')).toHaveTextContent(
      'No snoozed tasks',
    );
    expect(screen.getByRole('table', { name: 'Snoozed' })).toBeInTheDocument();
  });

  it('filters to the picked rules', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    await user.click(screen.getByTestId('tasks-type-trigger'));
    await user.click(
      within(await screen.findByTestId('tasks-type-panel')).getByRole('option', {
        name: /Confirm visits/,
      }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ type: ['confirm'] }),
    );
    await waitFor(() => expect(titles()).not.toContain('Collect ₹1,200 from Rhea'));
    expect(titles()).toContain('Confirm Priti’s visit');
    expect(screen.getByTestId('tasks-type-trigger')).toHaveTextContent('Confirm visits');
  });

  it('searches the title, the person and the why line', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'rhea');
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ q: 'rhea' }),
    );
    await waitFor(() => expect(titles()).not.toContain('Confirm Priti’s visit'));
    expect(titles()).toContain('Collect ₹1,200 from Rhea');
    for (const row of rows()) expect(row.textContent?.toLowerCase()).toContain('rhea');
  });

  it('drops a rule an admin switches off from the list', async () => {
    const user = userEvent.setup();
    renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    await user.click(screen.getByTestId('tasks-rules-trigger'));
    await user.click(await screen.findByRole('switch', { name: 'Confirm visits' }));
    await waitFor(() => expect(titles()).not.toContain('Confirm Priti’s visit'));
  });

  it('keeps the rules read-only for a role that is not Owner or Admin', async () => {
    const user = userEvent.setup();
    renderTasksRoutes(TASKS, TasksPage, { role: 'front_desk' });
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(screen.getByTestId('tasks-rules-trigger'));
    expect(await screen.findByRole('switch', { name: 'Confirm visits' })).toBeDisabled();
  });

  it('opens a task’s drawer route from its row, keeping the list’s params', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(`${TASKS}?scope=everyone`, TasksPage);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    await user.click(
      within(rowOf('Confirm Priti’s visit')).getByText('Confirm Priti’s visit'),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${TASKS}/${ref.task('k1')}`),
    );
    expect(router.state.location.search).toEqual({ scope: 'everyone' });
  });

  it('toasts the result of a Done entry with no task behind it (H:4270)', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(`${TASKS}?tab=done`, TasksPage);
    await waitFor(() =>
      expect(titles().some((title) => title.startsWith('Confirmed '))).toBe(true),
    );
    const entry = rows().find((row) => row.textContent?.includes('Confirmed '));
    await user.click(entry as HTMLElement);
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Patient replied Yes to the WhatsApp reminder',
    );
    expect(router.state.location.pathname).toBe(TASKS);
  });

  it('keeps the rows and toasts a failed load with Retry (§6.0 List error)', async () => {
    const user = userEvent.setup();
    renderTasksRoutes(TASKS, TasksPage);
    await waitFor(() => expect(titles()).toContain('Confirm Priti’s visit'));
    listGate.failing = true;
    await user.click(screen.getByTestId('tasks-tab-done'));
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Couldn’t load this list · connection dropped. Showing the last copy.',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Retry' }) }),
      ),
    );
    expect(rows().length).toBeGreaterThan(0);
  });
});
