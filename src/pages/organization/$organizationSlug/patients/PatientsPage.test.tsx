import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as PatientsApiModule from '@/shared/api/clinic/patients-api.ts';
import { listPatients } from '@/shared/api/clinic/patients-api.ts';

import {
  NOW,
  type PatientsWorld,
  seededPatientsWorld,
} from './__tests__/integration/patients-test-data.ts';
import {
  renderPatientsRoutes,
  resetPatientsRoutes,
} from './__tests__/integration/patients-test-router.tsx';
import { PatientsPage } from './PatientsPage.tsx';

const world = vi.hoisted(() => ({}) as PatientsWorld);
vi.mock('@/shared/api/clinic/patients-api.ts', async (importOriginal) => {
  const { patientsApiDouble } =
    await import('./__tests__/integration/patients-test-data.ts');
  return {
    ...(await importOriginal<typeof PatientsApiModule>()),
    ...patientsApiDouble(world),
  };
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  Object.assign(world, seededPatientsWorld());
  vi.mocked(listPatients).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  resetPatientsRoutes();
});

describe('PatientsPage', () => {
  it('renders the room — toolbar and table — with its title', async () => {
    const { container } = renderPatientsRoutes(
      '/organization/acme/patients',
      PatientsPage,
    );
    expect(await screen.findByTestId('patients-page')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Patients' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('patients-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('patients-table')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByTestId('patients-table-row')).toHaveLength(4),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the in-place skeleton while the first page loads', async () => {
    renderPatientsRoutes('/organization/acme/patients', PatientsPage);
    expect(await screen.findByTestId('skeleton-rows')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await waitFor(() => expect(screen.queryByTestId('skeleton-rows')).toBeNull());
    expect(screen.getAllByTestId('patients-table-row')).toHaveLength(4);
  });

  it('reads the list for the URL’s view, search, filters and sort', async () => {
    renderPatientsRoutes(
      '/organization/acme/patients?view=follow&q=shah&types=aesthetic&status=regular&conversion=not_converted&sort=followUp:desc',
      PatientsPage,
    );
    await waitFor(() => expect(listPatients).toHaveBeenCalled());
    expect(vi.mocked(listPatients).mock.lastCall?.[0]).toEqual({
      view: 'follow',
      q: 'shah',
      types: ['aesthetic'],
      status: 'regular',
      conversion: 'not_converted',
      created: undefined,
      followUp: undefined,
      sort: 'followUp',
      order: 'desc',
    });
  });
});
