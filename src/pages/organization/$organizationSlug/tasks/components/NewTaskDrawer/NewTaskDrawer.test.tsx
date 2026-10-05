import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as TasksApiModule from '@/shared/api/clinic/tasks-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import type * as NotifyModule from '@/shared/notify/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';

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
/** Drops the create's connection while `failing` is set (§6.0 Save, network). */
const createGate = vi.hoisted(() => ({ failing: false }));
vi.mock('@/shared/api/clinic/tasks-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof TasksApiModule>();
  return {
    ...actual,
    createTask: async (...args: Parameters<typeof actual.createTask>) => {
      if (createGate.failing) throw new Error('connection dropped');
      return actual.createTask(...args);
    },
  };
});

const TASKS = '/organization/acme/tasks';
const CREATE = `${TASKS}/create`;
const PRITI = patientRef('Priti Soni');
/** Kabir's lead is Nidhi's (`tasks-api.test.ts`). */
const KABIR_LEAD = ref.lead(2370);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  viewport.tier = 'desktop';
  createGate.failing = false;
  for (const mock of Object.values(notifyMock)) mock.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetTasksRoutes();
  resetClinicFixtures();
  vi.useRealTimers();
});

async function openNewTask(search = '') {
  const view = renderTasksRoutes(`${CREATE}${search}`, TasksPage);
  const drawer = await screen.findByTestId('new-task-drawer');
  return { ...view, drawer, user: userEvent.setup() };
}

const step = (id: string) => screen.getByTestId(`new-task-drawer-step-${id}`);
const rowTitles = () =>
  screen
    .queryAllByTestId('tasks-row')
    .map((row) => row.querySelector('.text-field')?.textContent ?? '');

/** Search the "For" picker and take the first hit. */
async function pickPerson(user: ReturnType<typeof userEvent.setup>, query: string) {
  await user.click(screen.getByTestId('new-task-for'));
  await user.type(await screen.findByTestId('new-task-for-search'), query);
  const panel = await screen.findByTestId('new-task-for-panel');
  const option = await within(panel).findAllByRole('option');
  await user.click(option[0] as HTMLElement);
}

describe('NewTaskDrawer (KICKOFF §6.10 New task, Q-T4)', () => {
  it('opens over the list: 720px, three steps, the first open, the defaults summed up', async () => {
    const { drawer } = await openNewTask();
    expect(within(drawer).getByRole('heading', { name: 'New task' })).toBeInTheDocument();
    expect(drawer).toHaveAccessibleDescription(
      'Shows in Tasks and on the person’s timeline',
    );
    expect(drawer).toHaveClass('md:w-[min(720px,calc(100vw-56px))]');
    expect(step('what')).toHaveAttribute('data-state', 'open');
    expect(screen.getByTestId('new-task-type-call_back')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() =>
      expect(step('when')).toHaveTextContent('Tomorrow 11 am · Riya S.'),
    );
    expect(step('how')).toHaveTextContent('Normal · Remind 15 min before');
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('asks whom the task is for before it saves', async () => {
    const { user } = await openNewTask();
    await user.click(screen.getByTestId('new-task-drawer-step-how-trigger'));
    await user.click(screen.getByTestId('new-task-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Pick whom the task is for');
    expect(step('what')).toHaveAttribute('data-state', 'open');
  });

  it('adds the task: the list stays and says so with Undo (D28)', async () => {
    const { user, router } = await openNewTask();
    await pickPerson(user, 'Priti');
    expect(screen.getByTestId('new-task-drawer')).toHaveAccessibleDescription(
      `For ${fsi('Priti Soni')} · shows in Tasks and on this person’s timeline`,
    );
    await user.type(screen.getByTestId('new-task-title'), 'Share the laser price');
    await user.click(screen.getByTestId('new-task-drawer-step-when-trigger'));
    await user.click(screen.getByTestId('new-task-due-inThreeDays'));
    await user.click(screen.getByTestId('new-task-drawer-step-how-trigger'));
    await user.click(screen.getByTestId('new-task-priority-high'));
    await user.click(screen.getByTestId('new-task-drawer-save'));

    await waitFor(() => expect(router.state.location.pathname).toBe(TASKS));
    expect(screen.queryByTestId('new-task-drawer')).not.toBeInTheDocument();
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Task added for Riya S. · In 3 days',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
    await waitFor(() => expect(rowTitles()).toContain('Share the laser price'));

    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() => expect(rowTitles()).not.toContain('Share the laser price'));
  });

  it('saves an empty title as "<type> · <first name>"', async () => {
    const { user } = await openNewTask();
    await pickPerson(user, 'Priti');
    await user.click(screen.getByTestId('new-task-type-follow_up'));
    await user.click(screen.getByTestId('new-task-drawer-save'));
    await waitFor(() => expect(rowTitles()).toContain('Follow-up · Priti'));
  });

  it('is for the patient ?patient= names', async () => {
    await openNewTask(`?patient=${PRITI}`);
    await waitFor(() =>
      expect(screen.getByTestId('new-task-drawer')).toHaveAccessibleDescription(
        `For ${fsi('Priti Soni')} · shows in Tasks and on this person’s timeline`,
      ),
    );
    expect(screen.getByTestId('new-task-drawer-summary')).toHaveTextContent(
      /^↔ Patient #\d+$/,
    );
  });

  it('assigns a lead’s task to the lead’s owner by default (H:6056)', async () => {
    await openNewTask(`?lead=${KABIR_LEAD}`);
    await waitFor(() =>
      expect(screen.getByTestId('new-task-drawer-summary')).toHaveTextContent(
        '↔ Lead #2370',
      ),
    );
    await waitFor(() => expect(step('when')).toHaveTextContent('Nidhi K.'));
  });

  it('keeps the drawer and its input when the connection drops', async () => {
    const { user } = await openNewTask(`?patient=${PRITI}`);
    await waitFor(() =>
      expect(screen.getByTestId('new-task-drawer-summary')).toBeInTheDocument(),
    );
    createGate.failing = true;
    await user.type(screen.getByTestId('new-task-title'), 'Call about the package');
    await user.click(screen.getByTestId('new-task-drawer-save'));
    await waitFor(() =>
      expect(screen.getByTestId('new-task-drawer-save')).toHaveTextContent('Retry save'),
    );
    expect(notifyMock.error).toHaveBeenCalledWith(
      expect.stringContaining('Couldn’t save'),
      expect.objectContaining({ action: expect.objectContaining({ label: 'Retry' }) }),
    );
    expect(screen.getByTestId('new-task-title')).toHaveValue('Call about the package');

    createGate.failing = false;
    await user.click(screen.getByTestId('new-task-drawer-save'));
    await waitFor(() => expect(notifyMock.undo).toHaveBeenCalledOnce());
  });

  it('closes at once when nothing was entered, and asks first after', async () => {
    const { user, router } = await openNewTask('?tab=done');
    await user.type(screen.getByTestId('new-task-title'), 'Half a thought');
    await user.click(screen.getByTestId('new-task-drawer-dismiss'));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(TASKS));
    expect(router.state.location.search).toEqual({ tab: 'done' });
  });
});
