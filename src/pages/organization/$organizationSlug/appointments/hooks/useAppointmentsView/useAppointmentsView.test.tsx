import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { appointmentRow } from '@/tests/utils/appointment-doubles.ts';

import { renderAppointmentsRoutes } from '../../__tests__/integration/appointments-test-router.tsx';
import { useAppointmentsView } from './useAppointmentsView.ts';

const tier = vi.hoisted(() => ({ current: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => tier.current,
}));

const PAGE = '/organization/acme/appointments';

/** Renders the view the hook answers. */
function Probe() {
  return <output data-testid="view">{useAppointmentsView()}</output>;
}

beforeEach(() => {
  tier.current = 'desktop';
});

describe('useAppointmentsView (D27)', () => {
  it('shows the Agenda by default and every view as the URL asks', async () => {
    renderAppointmentsRoutes(PAGE, Probe);
    expect(await screen.findByTestId('view')).toHaveTextContent('agenda');
    const week = renderAppointmentsRoutes(`${PAGE}?view=week`, Probe);
    await waitFor(() =>
      expect(screen.getAllByTestId('view').at(-1)).toHaveTextContent('week'),
    );
    expect(week.router.state.location.search).toEqual({ view: 'week' });
  });

  it('renders a Week link as Day on a phone and replaces the URL (H:5941)', async () => {
    tier.current = 'phone';
    const { router } = renderAppointmentsRoutes(
      `${PAGE}?view=week&date=2026-10-05`,
      Probe,
    );
    expect(await screen.findByTestId('view')).toHaveTextContent('day');
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: 'day', date: '2026-10-05' }),
    );
    expect(router.state.location.pathname).toBe(PAGE);
    expect(router.history).toHaveLength(1);
  });

  it('keeps an open drawer when it replaces Week on a phone', async () => {
    tier.current = 'phone';
    const { id } = appointmentRow();
    const { router } = renderAppointmentsRoutes(
      `${PAGE}/${id}?view=week&mode=reschedule`,
      Probe,
    );
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ view: 'day', mode: 'reschedule' }),
    );
    expect(router.state.location.pathname).toBe(`${PAGE}/${id}`);
  });

  it('keeps Week on a tablet', async () => {
    tier.current = 'tablet';
    const { router } = renderAppointmentsRoutes(`${PAGE}?view=week`, Probe);
    expect(await screen.findByTestId('view')).toHaveTextContent('week');
    expect(router.state.location.search).toEqual({ view: 'week' });
  });

  it('keeps every other view on a phone, the Agenda by default', async () => {
    tier.current = 'phone';
    const month = renderAppointmentsRoutes(`${PAGE}?view=month`, Probe);
    expect(await screen.findByTestId('view')).toHaveTextContent('month');
    expect(month.router.state.location.search).toEqual({ view: 'month' });
    month.unmount();

    renderAppointmentsRoutes(PAGE, Probe);
    expect(await screen.findByTestId('view')).toHaveTextContent('agenda');
  });
});
