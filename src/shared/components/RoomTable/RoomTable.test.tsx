import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { Package } from '@/shared/icons/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { RoomTable } from './RoomTable.tsx';

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
const onNew = vi.fn();
const onRowClick = vi.fn();

function Table({ rows, filtered = false }: { rows: Row[]; filtered?: boolean }) {
  const table = useRoomTable<Row>({
    tableId: 'stock-vendors',
    columns: [{ id: 'name', accessorKey: 'name', header: 'Vendor' }],
    rows,
    sort: undefined,
    onSortChange: vi.fn(),
  });
  return (
    <RoomTable
      table={table}
      tableId="stock-vendors"
      label="Vendors"
      list={LIST}
      loading={false}
      filtered={filtered}
      onClearFilters={vi.fn()}
      tone="mint"
      icon={<Package />}
      emptyTitle="No vendor matches"
      emptyHint="Nothing here yet. Try another tab or search."
      emptyAction={{ label: 'New clinic vendor', onSelect: onNew }}
      recordsLabel="vendors"
      countLabel={`${rows.length} vendors`}
      minWidth={600}
      onRowClick={onRowClick}
      rowTone={(row) => (row.name === 'Ibreia' ? 'blush' : undefined)}
      rowActions={(row) => [
        { id: 'edit', label: `Edit ${row.name}`, icon: Package, onSelect: vi.fn() },
      ]}
      exportName="vendors.csv"
      exportCopy={{ label: 'Export', done: (count) => `${count} rows exported` }}
    />
  );
}

beforeEach(() => {
  csv.downloadCsv.mockReset();
  onNew.mockReset();
  onRowClick.mockReset();
  notifyMock.success.mockReset();
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: 'admin' });
});
afterEach(() => {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
});

describe('RoomTable', () => {
  it('shows the empty state in the room’s tone with the tab’s New', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<Table rows={[]} />);
    expect(await screen.findByText('No vendor matches')).toBeVisible();
    expect(
      screen.getByText('Nothing here yet. Try another tab or search.'),
    ).toBeVisible();
    expect(screen.getByTestId('empty-state')).toHaveAttribute('data-tone', 'mint');
    await user.click(screen.getByRole('button', { name: 'New clinic vendor' }));
    expect(onNew).toHaveBeenCalledOnce();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('opens a row, draws its edge and actions, and exports the selection with the room’s toast', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Table
        rows={[
          { id: 'a', name: 'Ankur Pharma' },
          { id: 'b', name: 'Ibreia' },
        ]}
      />,
    );
    await screen.findByText('2 vendors');
    expect(screen.getByRole('button', { name: 'Edit Ibreia' })).toBeInTheDocument();
    await user.click(screen.getByText('Ankur Pharma'));
    expect(onRowClick).toHaveBeenCalledWith({ id: 'a', name: 'Ankur Pharma' });

    const [first] = screen.getAllByTestId('stock-vendors-table-select-row');
    if (!first) throw new Error('no row checkbox');
    await user.click(first);
    const bar = await screen.findByTestId('stock-vendors-table-bulk-bar');
    await user.click(within(bar).getByRole('button', { name: /Export/ }));
    await waitFor(() => expect(csv.downloadCsv).toHaveBeenCalledOnce());
    expect(csv.downloadCsv).toHaveBeenCalledWith('vendors.csv', 'Vendor\nAnkur Pharma');
    expect(notifyMock.success).toHaveBeenCalledWith('1 rows exported');
  });
});
