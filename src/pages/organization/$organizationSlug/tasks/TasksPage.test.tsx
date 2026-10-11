import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as DirectoryApiModule from '@/shared/api/app/directory-api.ts';
import type * as TasksApiModule from '@/shared/api/app/tasks-api.ts';
import type * as MyMembershipModule from '@/shared/tenancy/my-membership.ts';

import {
  NOW,
  seededTasksWorld,
  type TasksWorld,
} from './__tests__/integration/tasks-test-data.ts';
import {
  renderTasksRoutes,
  resetTasksRoutes,
} from './__tests__/integration/tasks-test-router.tsx';
import { TasksPage } from './TasksPage.tsx';

vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
  readViewportTier: () => 'desktop',
}));

const world = vi.hoisted(() => ({}) as TasksWorld);
vi.mock('@/shared/api/app/tasks-api.ts', async (importOriginal) => {
  const { tasksApiDouble } = await import('./__tests__/integration/tasks-test-data.ts');
  return {
    ...(await importOriginal<typeof TasksApiModule>()),
    ...tasksApiDouble(world),
  };
});
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => {
  const { directoryApiDouble } =
    await import('./__tests__/integration/tasks-test-data.ts');
  return {
    ...(await importOriginal<typeof DirectoryApiModule>()),
    ...directoryApiDouble(world),
  };
});
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => {
  const { RIYA } = await import('./__tests__/integration/tasks-test-data.ts');
  return {
    ...(await importOriginal<typeof MyMembershipModule>()),
    findMyMembershipId: async () => RIYA.id,
  };
});

// The drawers over the list have their own suites — stand-ins here.
vi.mock('./hooks/useTasksDialogRoute/index.ts', async () => {
  const { useTasksDialogRouteStub } =
    await import('./__tests__/integration/tasks-test-router.tsx');
  return { useTasksDialogRoute: useTasksDialogRouteStub };
});
vi.mock('./hooks/useTaskActions/index.ts', () => ({ useTaskActions: () => ({}) }));
vi.mock('./components/NewTaskDrawer/index.ts', () => ({ NewTaskDrawer: () => null }));
vi.mock('./components/TaskDrawer/index.ts', () => ({ TaskDrawer: () => null }));
vi.mock('./components/WhatsNextSheet/index.ts', () => ({ WhatsNextSheet: () => null }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  Object.assign(world, seededTasksWorld());
});
afterEach(() => {
  resetTasksRoutes();
  vi.useRealTimers();
});

describe('TasksPage', () => {
  it('renders the room: the toolbar over the To do list', async () => {
    const { container } = renderTasksRoutes('/organization/acme/tasks', TasksPage);
    expect(await screen.findByTestId('tasks-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByTestId('tasks-row').length).toBeGreaterThan(0),
    );
    expect(screen.getByRole('table', { name: 'To do' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
