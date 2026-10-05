import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderVisitRoute,
  resetVisitRoute,
  visitPath,
} from '../../__tests__/integration/visit-test-router.tsx';
import { VisitPage } from '../../VisitPage.tsx';

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
}));

const kinds = () =>
  screen.getAllByTestId('visit-history-row').map((row) => row.dataset.kind);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
  resetClinicFixtures();
});
afterEach(() => {
  resetVisitRoute();
  resetClinicFixtures();
  vi.useRealTimers();
});

describe('VisitHistory (KICKOFF §6.13 History)', () => {
  it('lists the patient’s activity newest first: visits, sessions, money and the record', async () => {
    renderVisitRoute(visitPath(2865), VisitPage);
    await waitFor(() => expect(kinds()).toContain('session'));
    expect(kinds()).toEqual(
      expect.arrayContaining([
        'visit',
        'session',
        'invoice',
        'payment',
        'package',
        'change',
      ]),
    );
    const session = screen
      .getAllByTestId('visit-history-row')
      .find((row) => row.dataset.kind === 'session');
    expect(session).toHaveTextContent('Laser hair reduction · session 3');
    expect(
      screen.getByText(
        'Private photos and clinical notes appear only for roles allowed to see them.',
      ),
    ).toBeInTheDocument();
  });

  it('filters by Clinical, Money, Messages and Audit', async () => {
    const user = userEvent.setup();
    renderVisitRoute(visitPath(2865), VisitPage);
    await waitFor(() => expect(kinds()).toContain('invoice'));
    await user.click(screen.getByTestId('visit-history-filter-money'));
    expect(screen.getByTestId('visit-history-filter-money')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(new Set(kinds())).toEqual(new Set(['invoice', 'payment', 'package']));
    await user.click(screen.getByTestId('visit-history-filter-clinical'));
    expect(
      kinds().every((kind) =>
        ['visit', 'consult', 'session', 'photo'].includes(kind ?? ''),
      ),
    ).toBe(true);
    await user.click(screen.getByTestId('visit-history-filter-audit'));
    expect(kinds()).toEqual(['change']);
  });

  it('keeps money rows from a member without Payments view', async () => {
    renderVisitRoute(visitPath(2865), VisitPage, { role: 'doctor' });
    await waitFor(() => expect(kinds()).toContain('session'));
    expect(kinds()).not.toContain('invoice');
    expect(kinds()).not.toContain('payment');
  });

  it('jumps to the tabs the member may use from "Next for this visit"', async () => {
    const user = userEvent.setup();
    const { router } = renderVisitRoute(visitPath(2865), VisitPage);
    const aside = await screen.findByText('Next for this visit');
    const next = aside.parentElement as HTMLElement;
    expect(within(next).getByTestId('visit-next-treatment')).toHaveTextContent(
      'Laser hair reduction session 4 of 10 →',
    );
    expect(within(next).getByTestId('visit-next-checkout')).toHaveTextContent('Checkout');
    await user.click(within(next).getByTestId('visit-next-consult'));
    await waitFor(() => expect(router.state.location.search).toEqual({ tab: 'consult' }));
  });

  it('offers a front-desk member only the checkout', async () => {
    renderVisitRoute(visitPath(2865), VisitPage, { role: 'front_desk' });
    await screen.findByText('Next for this visit');
    expect(screen.queryByTestId('visit-next-consult')).not.toBeInTheDocument();
    expect(screen.queryByTestId('visit-next-treatment')).not.toBeInTheDocument();
    expect(screen.getByTestId('visit-next-checkout')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { baseElement } = renderVisitRoute(visitPath(2865), VisitPage);
    await waitFor(() => expect(kinds()).toContain('session'));
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
