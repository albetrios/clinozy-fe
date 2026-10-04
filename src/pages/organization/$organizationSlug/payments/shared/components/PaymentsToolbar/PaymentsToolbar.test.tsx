import { useTable } from '@tanstack/react-table';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { LedgerRow } from '@/shared/api/clinic/payments-contracts.ts';
import { dataTableFeatures } from '@/shared/components/DataTable/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { ArrowDownLeft, ArrowUpRight } from '@/shared/icons/index.ts';

import {
  renderPaymentsRoutes,
  resetPaymentsRoutes,
} from '../../../__tests__/integration/payments-test-router.tsx';
import { LEDGER_FILTER_FIELDS, LEDGER_TABLE_ID } from '../../../payments.constants.ts';
import { PaymentsToolbar, type PaymentsToolbarProps } from './PaymentsToolbar.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const NO_ROWS: LedgerRow[] = [];
const props = vi.hoisted(() => ({
  current: {} as Partial<Omit<PaymentsToolbarProps<LedgerRow>, 'table'>>,
}));

/** The toolbar over an empty table, as the ledger mounts it. */
function Harness() {
  const table = useTable({
    features: dataTableFeatures,
    data: NO_ROWS,
    columns: [
      { id: 'ref', header: 'Ref', enableHiding: false },
      { id: 'party', header: 'From / to' },
    ],
  });
  return (
    <PaymentsToolbar
      table={table}
      tableId={LEDGER_TABLE_ID}
      filters={{ fields: LEDGER_FILTER_FIELDS, copy: {} }}
      {...props.current}
    />
  );
}

const LEDGER = '/organization/acme/payments';

beforeEach(() => {
  viewport.tier = 'desktop';
  props.current = {};
});
afterEach(() => resetPaymentsRoutes());

describe('PaymentsToolbar (payments.md:17)', () => {
  it('draws the h1, the two tab links, search, Filters, Columns, Day close, Pay and Receive', async () => {
    const user = userEvent.setup();
    const onDayClose = vi.fn();
    const onPay = vi.fn();
    const onReceive = vi.fn();
    props.current = {
      onDayClose,
      primary: {
        action: {
          id: 'receive',
          label: 'Receive',
          icon: ArrowDownLeft,
          onSelect: onReceive,
        },
        secondary: {
          id: 'pay',
          label: 'Pay',
          icon: ArrowUpRight,
          iconClassName: 'text-destructive',
          onSelect: onPay,
        },
      },
    };
    const { container } = renderPaymentsRoutes(LEDGER, { ledger: Harness });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Payments' }),
    ).toBeInTheDocument();
    const nav = within(screen.getByRole('navigation', { name: 'Payments sections' }));
    expect(nav.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Payments',
      'Pending',
    ]);
    expect(nav.getByRole('link', { name: 'Payments' })).toHaveAttribute('href', LEDGER);
    expect(nav.getByRole('link', { name: 'Pending' })).toHaveAttribute(
      'href',
      `${LEDGER}/pending`,
    );
    expect(screen.getByRole('searchbox', { name: 'Search payments' })).toHaveAttribute(
      'placeholder',
      'Patient, invoice or receipt',
    );
    expect(screen.getByTestId('payments-filters-trigger')).toHaveTextContent('Filters');
    expect(screen.getByTestId('payments-columns-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('payments-toolbar')).toHaveAttribute(
      'data-layout',
      'actions',
    );
    await user.click(screen.getByTestId('payments-day-close'));
    expect(onDayClose).toHaveBeenCalledTimes(1);
    // Pay before Receive, outline before the primary.
    const [pay, receive] = [
      screen.getByTestId('payments-pay'),
      screen.getByTestId('payments-receive'),
    ];
    expect(pay.compareDocumentPosition(receive) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await user.click(pay);
    await user.click(receive);
    expect(onPay).toHaveBeenCalledTimes(1);
    expect(onReceive).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('leaves out Day close and the create actions for a role without them', async () => {
    renderPaymentsRoutes(LEDGER, { ledger: Harness });
    expect(await screen.findByTestId('payments-toolbar')).toBeInTheDocument();
    expect(screen.queryByTestId('payments-day-close')).toBeNull();
    expect(screen.queryByTestId('payments-receive')).toBeNull();
    expect(screen.queryByTestId('payments-pay')).toBeNull();
  });
});
