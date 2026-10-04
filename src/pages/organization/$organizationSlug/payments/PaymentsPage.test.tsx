import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderPaymentsRoutes,
  resetPaymentsRoutes,
} from './__tests__/integration/payments-test-router.tsx';

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const LEDGER = '/organization/acme/payments';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetPaymentsRoutes();
  resetClinicFixtures();
});

describe('PaymentsPage', () => {
  it('renders the room — toolbar and ledger — with its title', async () => {
    const { container } = renderPaymentsRoutes(LEDGER);
    expect(await screen.findByTestId('payments-page')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Payments' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('payments-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('payments-table')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByTestId('payments-table-row').length).toBeGreaterThan(0),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the in-place skeleton while the first page loads', async () => {
    renderPaymentsRoutes(LEDGER);
    expect(await screen.findByTestId('skeleton-rows')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await waitFor(() => expect(screen.queryByTestId('skeleton-rows')).toBeNull());
  });

  it('offers Show (All by default), What, Mode and Created — each value in its tone', async () => {
    const user = userEvent.setup();
    renderPaymentsRoutes(LEDGER);
    await user.click(await screen.findByTestId('payments-filters-trigger'));
    const panel = await screen.findByTestId('payments-filters');
    expect(
      within(panel)
        .getAllByRole('group')
        .map((group) => group.firstChild?.textContent),
    ).toEqual(['Show', 'What', 'Mode', 'Created']);
    const tone = (label: string) =>
      within(panel).getByText(label).closest('[data-tone]')?.getAttribute('data-tone');
    expect(within(panel).getByText('All')).toBeInTheDocument();
    expect(tone('Refund to patient')).toBe('blush');
    expect(tone('Money back')).toBe('stone');
    expect(tone('Cash')).toBe('butter');
    expect(tone('Credit')).toBe('lav');
  });
});
