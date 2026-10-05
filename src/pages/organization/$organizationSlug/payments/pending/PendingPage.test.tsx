import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderPaymentsRoutes,
  resetPaymentsRoutes,
} from '../__tests__/integration/payments-test-router.tsx';

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const PENDING = '/organization/acme/payments/pending';

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

describe('PendingPage', () => {
  it('renders the Pending tab — toolbar and credits — under the room’s title', async () => {
    const { container } = renderPaymentsRoutes(PENDING);
    expect(await screen.findByTestId('payments-pending-page')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Payments' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('payments-pending-toolbar')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByTestId('payments-pending-table-row')).toHaveLength(2),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('offers Which way, State and Created — each value in its tone', async () => {
    const user = userEvent.setup();
    renderPaymentsRoutes(PENDING);
    await user.click(await screen.findByTestId('payments-pending-filters-trigger'));
    const panel = await screen.findByTestId('payments-pending-filters');
    expect(
      within(panel)
        .getAllByRole('group')
        .map(
          (group) =>
            document.getElementById(group.getAttribute('aria-labelledby') ?? '')
              ?.textContent,
        ),
    ).toEqual(['Which way', 'State', 'Created']);
    const tone = (label: string) =>
      within(panel).getByText(label).closest('[data-tone]')?.getAttribute('data-tone');
    expect(tone('Give')).toBe('blush');
    expect(tone('Take')).toBe('sky');
    expect(tone('Adjusted')).toBe('lav');
  });

  it('says "Nothing pending" when no credit is left, with Add pending', async () => {
    for (const seq of [1, 2]) {
      await clinicFixtures.pendingCredits.remove(ref.pendingCredit(seq), 'mistake', null);
    }
    renderPaymentsRoutes(PENDING);
    const empty = await screen.findByTestId('empty-state');
    expect(within(empty).getByText('Nothing pending')).toBeInTheDocument();
    expect(within(empty).getByTestId('empty-state-action')).toHaveTextContent(
      'Add pending',
    );
  });
});
