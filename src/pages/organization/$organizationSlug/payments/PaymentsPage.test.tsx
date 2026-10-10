import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as PaymentsApiModule from '@/shared/api/clinic/payments-api.ts';
import { listLedger } from '@/shared/api/clinic/payments-api.ts';

import {
  LEDGER_NOW,
  ledgerWorld,
  seededLedger,
} from './__tests__/integration/payments-ledger-data.ts';
import {
  PAYMENTS_OWNER_CODES,
  renderPaymentsRoutes,
  resetPaymentsRoutes,
} from './__tests__/integration/payments-test-router.tsx';

vi.mock('@/shared/api/clinic/payments-api.ts', async (importOriginal) => {
  const { ledgerApiDouble } =
    await import('./__tests__/integration/payments-ledger-data.ts');
  const double = ledgerApiDouble();
  return {
    ...(await importOriginal<typeof PaymentsApiModule>()),
    listLedger: vi.fn(double.listLedger),
    fetchLedgerCount: vi.fn(double.fetchLedgerCount),
  };
});

const LEDGER = '/organization/acme/payments';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(LEDGER_NOW);
  ledgerWorld.rows = seededLedger();
  vi.mocked(listLedger).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  resetPaymentsRoutes();
});

describe('PaymentsPage', () => {
  it('renders the room — toolbar and ledger — with its title', async () => {
    const { container } = renderPaymentsRoutes(LEDGER, {
      permissions: PAYMENTS_OWNER_CODES,
    });
    expect(await screen.findByTestId('payments-page')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Payments' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('payments-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('payments-table')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByTestId('payments-table-row')).toHaveLength(6),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the in-place skeleton while the first page loads', async () => {
    renderPaymentsRoutes(LEDGER, { permissions: PAYMENTS_OWNER_CODES });
    expect(await screen.findByTestId('skeleton-rows')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await waitFor(() => expect(screen.queryByTestId('skeleton-rows')).toBeNull());
  });

  it('offers Show (All by default), What, Mode and Created — each value in its tone', async () => {
    const user = userEvent.setup();
    renderPaymentsRoutes(LEDGER, { permissions: PAYMENTS_OWNER_CODES });
    await user.click(await screen.findByTestId('payments-filters-trigger'));
    const panel = await screen.findByTestId('payments-filters');
    expect(
      within(panel)
        .getAllByRole('group')
        .map(
          (group) =>
            document.getElementById(group.getAttribute('aria-labelledby') ?? '')
              ?.textContent,
        ),
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
