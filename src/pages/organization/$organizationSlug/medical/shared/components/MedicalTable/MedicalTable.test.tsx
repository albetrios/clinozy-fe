import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { MedicalTable } from './MedicalTable.tsx';

vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
  readViewportTier: () => 'desktop',
}));
const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }));
vi.mock('@/lib/csv.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadCsv: csv.downloadCsv,
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

interface Row {
  id: string;
  name: string;
}

const LIST = { hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn() };

function Table({ rows, filtered = false }: { rows: Row[]; filtered?: boolean }) {
  const table = useRoomTable<Row>({
    tableId: 'medical-mrs',
    columns: [{ id: 'name', accessorKey: 'name', header: 'MR' }],
    rows,
    sort: undefined,
    onSortChange: vi.fn(),
  });
  return (
    <MedicalTable
      tab="mrs"
      table={table}
      list={LIST}
      loading={false}
      filtered={filtered}
      onClearFilters={vi.fn()}
      emptyTitle="No MR matches"
      recordsLabel="MRs"
      countLabel={`${rows.length} MRs`}
      minWidth={600}
      exportName="mrs.csv"
    />
  );
}

beforeEach(() => {
  csv.downloadCsv.mockReset();
});
afterEach(() => resetMedicalRoutes());

describe('MedicalTable', () => {
  it('shows the blush empty state, with no button', async () => {
    const { container } = renderMedicalRoutes('/organization/acme/medical/mrs', {
      mrs: () => <Table rows={[]} />,
    });
    expect(await screen.findByText('No MR matches')).toBeVisible();
    expect(screen.getByTestId('empty-state')).toHaveAttribute('data-tone', 'blush');
    expect(within(screen.getByTestId('empty-state')).queryByRole('button')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('exports the selected rows as CSV from the bulk bar', async () => {
    const user = userEvent.setup();
    renderMedicalRoutes('/organization/acme/medical/mrs', {
      mrs: () => (
        <Table
          rows={[
            { id: 'a', name: 'Rakesh' },
            { id: 'b', name: 'Meet' },
          ]}
        />
      ),
    });
    await screen.findByText('2 MRs');
    const [first] = screen.getAllByTestId('medical-mrs-table-select-row');
    if (!first) throw new Error('no row checkbox');
    await user.click(first);
    const bar = await screen.findByTestId('medical-mrs-table-bulk-bar');
    await user.click(within(bar).getByRole('button', { name: /Export/ }));
    await waitFor(() => expect(csv.downloadCsv).toHaveBeenCalledOnce());
    expect(csv.downloadCsv).toHaveBeenCalledWith('mrs.csv', 'MR\nRakesh');
  });
});
