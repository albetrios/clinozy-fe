import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderTasksRoutes,
  resetTasksRoutes,
} from '../../__tests__/integration/tasks-test-router.tsx';
import { useTasksDialogRoute } from './useTasksDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const TASKS = '/organization/acme/tasks';
const PRITI = ref.task('k1');
const UNKNOWN = '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f';

/** Shows what the hook reads, and closes through it. */
function Probe() {
  const { dialog, close } = useTasksDialogRoute();
  return (
    <>
      <output>
        {JSON.stringify({
          kind: dialog.kind,
          taskId: dialog.kind === 'task' ? dialog.taskId : null,
          title: dialog.kind === 'task' ? (dialog.detail?.task.title ?? null) : null,
        })}
      </output>
      <button type="button" onClick={close}>
        Close
      </button>
    </>
  );
}

const read = () => JSON.parse(screen.getByRole('status').textContent ?? '{}') as unknown;

beforeEach(() => {
  // The seeded tasks are dated from the clock: pin it, so the fixture holds on any day.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  resetClinicFixtures();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});
afterEach(() => {
  resetTasksRoutes();
  vi.useRealTimers();
});

describe('useTasksDialogRoute (D24, S:97, S:115)', () => {
  it('opens nothing over the bare list', async () => {
    renderTasksRoutes(TASKS, Probe);
    await waitFor(() =>
      expect(read()).toEqual({ kind: 'none', taskId: null, title: null }),
    );
  });

  it('opens the task the URL names, once its read arrives', async () => {
    renderTasksRoutes(`${TASKS}/${PRITI}`, Probe);
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'task',
        taskId: PRITI,
        title: 'Confirm Priti’s visit',
      }),
    );
  });

  it('answers an unknown id with the list in place and "Task not found"', async () => {
    const { router } = renderTasksRoutes(`${TASKS}/${UNKNOWN}?tab=snoozed`, Probe);
    await waitFor(() => expect(router.state.location.pathname).toBe(TASKS));
    expect(router.state.location.search).toEqual({ tab: 'snoozed' });
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Task not found · it may have been deleted',
    );
    expect(read()).toMatchObject({ kind: 'none' });
  });

  it('closes onto the list with its own params', async () => {
    const user = userEvent.setup();
    const { router } = renderTasksRoutes(`${TASKS}/${PRITI}?scope=everyone`, Probe);
    await waitFor(() => expect(read()).toMatchObject({ kind: 'task' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(TASKS));
    expect(router.state.location.search).toEqual({ scope: 'everyone' });
  });
});
