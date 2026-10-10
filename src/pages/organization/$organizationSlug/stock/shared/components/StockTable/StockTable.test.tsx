import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { StockTable } from './StockTable.tsx';

vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
  readViewportTier: () => 'desktop',
}));
const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }));
vi.mock('@/lib/csv.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadCsv: csv.downloadCsv,
}));
const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

interface Row {
  id: string;
  name: string;
}

const LIST = { hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn() };

function Table({ rows }: { rows: Row[] }) {
  const table = useRoomTable<Row>({
    tableId: 'stock-items',
    columns: [{ id: 'name', accessorKey: 'name', header: 'Item' }],
    rows,
    sort: undefined,
    onSortChange: vi.fn(),
  });
  return (
    <StockTable
      tab="items"
      table={table}
      list={LIST}
      loading={false}
      filtered={false}
      onClearFilters={vi.fn()}
      emptyTitle="No item matches"
      recordsLabel="items"
      minWidth={600}
      exportName="clinic-stock-items.csv"
    />
  );
}

beforeEach(() => {
  csv.downloadCsv.mockReset();
  notifyMock.success.mockReset();
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: 'admin' });
});
afterEach(() => {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
});

describe('StockTable', () => {
  it('shows the room’s mint empty state and hint', async () => {
    const { container } = renderWithProviders(<Table rows={[]} />);
    expect(await screen.findByText('No item matches')).toBeVisible();
    expect(
      screen.getByText('Nothing here yet. Try another tab or search.'),
    ).toBeVisible();
    expect(screen.getByTestId('empty-state')).toHaveAttribute('data-tone', 'mint');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names the table by its tab and exports with the room’s words', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Table rows={[{ id: 'a', name: 'Gauze swabs' }]} />);
    expect(await screen.findByText('Gauze swabs')).toBeVisible();
    const [check] = screen.getAllByTestId('stock-items-table-select-row');
    if (!check) throw new Error('no row checkbox');
    await user.click(check);
    const bar = await screen.findByTestId('stock-items-table-bulk-bar');
    await user.click(within(bar).getByRole('button', { name: /Export/ }));
    await waitFor(() => expect(csv.downloadCsv).toHaveBeenCalledOnce());
    expect(notifyMock.success).toHaveBeenCalledWith('1 row exported as CSV');
  });

  it('asks a signed-in member for `stock_item:export`, whatever their roles allow', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Table rows={[{ id: 'a', name: 'Gauze swabs' }]} />);
    act(() => {
      useUIStore.setState({ previewRole: null });
      useOrganizationStore
        .getState()
        .setPermissions(['organization:read', 'stock_item:read']);
    });
    await user.click(await screen.findByTestId('stock-items-table-select-all'));
    expect(screen.queryByTestId('stock-items-table-bulk-export')).not.toBeInTheDocument();

    act(() =>
      useOrganizationStore
        .getState()
        .setPermissions(['organization:read', 'stock_item:read', 'stock_item:export']),
    );
    expect(
      await screen.findByTestId('stock-items-table-bulk-export'),
    ).toBeInTheDocument();
  });
});
