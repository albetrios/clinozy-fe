import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderTasksRoutes,
  resetTasksRoutes,
} from './__tests__/integration/tasks-test-router.tsx';
import { TasksPage } from './TasksPage.tsx';

vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
  readViewportTier: () => 'desktop',
}));

beforeEach(() => {
  // The seeded tasks are dated from the clock: pin it, so the list holds on any day.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  resetClinicFixtures();
});
afterEach(() => {
  resetTasksRoutes();
  resetClinicFixtures();
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
