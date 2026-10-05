import { useSearch } from '@tanstack/react-router';
import { type ColumnDef, useTable } from '@tanstack/react-table';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { DataTableColumnHeader } from '@/shared/components/DataTableColumnHeader/index.ts';
import { DataTablePagination } from '@/shared/components/DataTablePagination/index.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { RoomToolbar } from '@/shared/components/RoomToolbar/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { PenLine, Receipt, Trash, Wallet } from '@/shared/icons/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { DataTable, type DataTableProps } from './DataTable.tsx';
import { type DataTableFeatures, dataTableFeatures } from './table-features.ts';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

let scrollerWidth = 0;
beforeEach(() => {
  viewport.tier = 'desktop';
  scrollerWidth = 0;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
    () => scrollerWidth,
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const COLUMNS = [{ accessorKey: 'name', header: 'Name' }];
const DATA = [{ name: 'Ada' }, { name: 'Grace' }];

function Harness() {
  const table = useTable({
    features: dataTableFeatures,
    data: DATA,
    columns: COLUMNS,
  });
  return <DataTable table={table} />;
}

describe('DataTable', () => {
  it('renders header and rows from the table instance', () => {
    render(<Harness />);
    expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Grace')).toBeInTheDocument();
  });

  it('shows the empty message, and a custom empty state in its place', () => {
    function Empty({ empty }: { empty?: React.ReactNode }) {
      const table = useTable({ features: dataTableFeatures, data: [], columns: COLUMNS });
      return <DataTable table={table} emptyMessage="Nothing yet" empty={empty} />;
    }
    const { rerender } = render(<Empty />);
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
    rerender(<Empty empty={<p>No patients match</p>} />);
    expect(screen.getByText('No patients match')).toBeInTheDocument();
  });

  it("keeps the open record's row on the muted fill", () => {
    function Active() {
      const table = useTable({
        features: dataTableFeatures,
        data: DATA,
        columns: COLUMNS,
      });
      return (
        <DataTable table={table} isRowActive={(row) => row.original.name === 'Grace'} />
      );
    }
    render(<Active />);
    const rows = screen.getAllByTestId('data-table-row');
    expect(rows[1]).toHaveAttribute('data-active', 'true');
    expect(rows[1]?.className).toContain('data-[active=true]:bg-muted');
    expect(rows[0]).not.toHaveAttribute('data-active');
  });
});

interface Person {
  name: string;
  joinedAt: string;
}

function person(index: number, joinedAt = '2025-01-12T09:00:00.000Z'): Person {
  // Zero-padded so lexicographic order matches numeric order, letting the
  // sorting assertions name an exact expected first row.
  return { name: `Person ${String(index).padStart(2, '0')}`, joinedAt };
}

const KIT_COLUMNS: ColumnDef<DataTableFeatures, Person>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
  },
  {
    accessorKey: 'joinedAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Joined" />,
  },
];

/**
 * The whole kit, wired the way a list page wires it: toolbar, table,
 * pagination. The toolbar's search writes the URL's `q`; a list filtered on
 * the client feeds it to the name column's filter.
 */
function KitHarness({ data }: Readonly<{ data: Person[] }>) {
  const { q }: { q?: string } = useSearch({ strict: false });
  // A new filter array each render would read as a filter change and reset the page.
  const columnFilters = useMemo(() => (q ? [{ id: 'name', value: q }] : []), [q]);
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns: KIT_COLUMNS,
    state: { columnFilters },
  });
  return (
    <>
      <RoomToolbar
        title="People"
        tableId="people"
        search={{ placeholder: 'Search people', label: 'Search people' }}
      />
      <DataTable table={table} selectable />
      <DataTablePagination table={table} />
    </>
  );
}

/** Render the kit and wait for it: the providers mount asynchronously. */
async function renderKit(data: Person[]) {
  renderWithProviders(<KitHarness data={data} />);
  await screen.findByPlaceholderText('Search people');
}

/** Row names in render order, excluding the header row. */
function renderedNames(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).queryByText(/^Person \d\d$/)?.textContent ?? '')
    .filter(Boolean);
}

// TanStack Table v9 makes every feature opt-in via the shared `dataTableFeatures`
// set. A feature omitted there still type-checks at the call site but dies at
// runtime, so each registered feature is exercised through the kit's UI rather
// than asserted structurally.
describe('DataTable kit features', () => {
  it('sorts rows when a column header is clicked: ascending, descending, off', async () => {
    const user = userEvent.setup();
    await renderKit([person(2), person(1), person(3)]);
    const header = screen.getByRole('button', { name: /^name/i });

    await user.click(header);
    expect(renderedNames()[0]).toBe('Person 01');
    await user.click(header);
    expect(renderedNames()[0]).toBe('Person 03');
    await user.click(header);
    expect(renderedNames()[0]).toBe('Person 02');
  });

  it('sorts a column of ISO timestamps, which resolves a different comparator', async () => {
    const user = userEvent.setup();
    await renderKit([
      person(1, '2025-03-01T09:00:00.000Z'),
      person(2, '2025-01-01T09:00:00.000Z'),
      person(3, '2025-02-01T09:00:00.000Z'),
    ]);

    await user.click(screen.getByRole('button', { name: /^joined/i }));

    expect(renderedNames()).toEqual(['Person 02', 'Person 03', 'Person 01']);
  });

  // The one comparator `table-features.ts` registers: a column filter fed from the
  // toolbar's search resolves to `includesString`, and dropping it silently stops
  // filtering.
  it('filters rows through the toolbar search input', async () => {
    const user = userEvent.setup();
    await renderKit([person(1), person(2), person(3)]);
    expect(renderedNames()).toHaveLength(3);

    await user.type(screen.getByPlaceholderText('Search people'), 'Person 02');

    await waitFor(() => expect(renderedNames()).toEqual(['Person 02']));
  });

  it('paginates when rows exceed the default page size', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 12 }, (_, i) => person(i + 1));
    await renderKit(many);

    // Default page size is 10, so 12 rows split 10 + 2.
    expect(renderedNames()).toHaveLength(10);
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next page/i }));

    expect(renderedNames()).toEqual(['Person 11', 'Person 12']);
  });

  it('tracks row selection from the select-all checkbox in the bulk bar', async () => {
    const user = userEvent.setup();
    await renderKit([person(1), person(2)]);

    await user.click(screen.getByRole('checkbox', { name: /select all/i }));

    expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toHaveTextContent(
      '2 selected',
    );
  });
});

// ── The room table (KICKOFF §3.5 Data table) ─────────────────────────────────

interface Patient {
  id: string;
  name: string;
  phone: string;
  type: string;
  status: string;
  followUp: string;
  due: number;
  updated: string;
}

const patient = (index: number, overrides: Partial<Patient> = {}): Patient => ({
  id: `#35${String(index).padStart(2, '0')}`,
  name: `Patient ${String(index).padStart(3, '0')}`,
  phone: '+91 82006 03212',
  type: 'Aesthetic',
  status: 'Regular',
  followUp: 'Sep 24 · 14:50',
  due: 2000,
  updated: 'Riya S.',
  ...overrides,
});

const PATIENT_COLUMNS: ColumnDef<DataTableFeatures, Patient>[] = [
  { accessorKey: 'id', header: 'ID', meta: { track: '64px', kind: 'id' } },
  {
    accessorKey: 'name',
    header: 'Patient',
    meta: { track: 'minmax(200px,1.4fr)', kind: 'person' },
  },
  {
    accessorKey: 'type',
    header: 'Type',
    meta: {
      track: 'minmax(120px,1fr)',
      kind: 'badges',
      foldValue: (row: Patient) => ({ value: row.type, dotClassName: 'bg-tone-lav-dot' }),
    },
  },
  { accessorKey: 'status', header: 'Status', meta: { track: '96px', kind: 'badges' } },
  {
    accessorKey: 'followUp',
    header: 'Follow-up',
    meta: { track: '150px', kind: 'badges' },
  },
  {
    accessorKey: 'due',
    header: 'Due',
    cell: ({ row }) => `₹${row.original.due}`,
    meta: { track: '96px', align: 'end', foldValue: (row: Patient) => `₹${row.due}` },
  },
  {
    accessorKey: 'updated',
    header: 'Updated',
    // The 28px people pill folds to nothing (H:4115).
    meta: { track: 'minmax(150px,1fr)', foldValue: () => null },
  },
];

const patientActions = (onSelect = vi.fn()): DataTableRowAction[] => [
  { id: 'invoice', label: 'New invoice', icon: Receipt, onSelect },
  { id: 'collect', label: 'Collect ₹2,000', icon: Wallet, onSelect },
  { id: 'edit', label: 'Edit', icon: PenLine, onSelect },
  { id: 'delete', label: 'Delete', icon: Trash, onSelect, destructive: true },
];

type RoomProps = Omit<DataTableProps<Patient>, 'table'> & { data: Patient[] };

function Room({ data, ...props }: RoomProps) {
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns: PATIENT_COLUMNS,
    manualPagination: true,
    getRowId: (row) => row.id,
  });
  return (
    <DataTable table={table} tableId="patients" recordsLabel="patients" {...props} />
  );
}

const headerLabels = () =>
  screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent ?? '')
    .filter((text) => text !== '' && text !== 'Actions');

describe('DataTable — fold engine', () => {
  it('folds what does not fit into the primary cell’s meta line (Patients at 820)', async () => {
    scrollerWidth = 794;
    const user = userEvent.setup();
    render(
      <Room data={[patient(8)]} fold selectable rowActions={() => patientActions()} />,
    );

    expect(headerLabels()).toEqual(['Patient', 'Type', 'Due']);
    const meta = screen.getByText('#3508').closest('[data-slot="data-table-meta"]');
    expect(meta).toHaveTextContent(/^#3508 Status Regular Follow-up Sep 24 · 14:50$/);
    expect(meta).not.toHaveTextContent('Updated');

    const toggle = screen.getByTestId('patients-table-fold-toggle');
    expect(toggle).toHaveTextContent('4 columns in rows · Show all');

    await user.click(toggle);
    expect(headerLabels()).toEqual([
      'ID',
      'Patient',
      'Type',
      'Status',
      'Follow-up',
      'Due',
      'Updated',
    ]);
    expect(
      screen.queryByText('#3508')?.closest('[data-slot="data-table-meta"]'),
    ).toBeNull();
    expect(screen.getByTestId('patients-table-fold-toggle')).toHaveTextContent(
      'Fit to width',
    );
    // "Show all" scrolls sideways: header and rows share one min-width.
    const table = screen.getByRole('table');
    expect(table.style.getPropertyValue('--dt-min-w')).not.toBe('0px');
  });

  it('folds fewer columns as the width grows, and none at 1440', () => {
    scrollerWidth = 998;
    const { unmount } = render(
      <Room data={[patient(8)]} fold selectable rowActions={() => patientActions()} />,
    );
    expect(screen.getByTestId('patients-table-fold-toggle')).toHaveTextContent(
      '2 columns in rows · Show all',
    );
    unmount();

    scrollerWidth = 1398;
    render(
      <Room data={[patient(8)]} fold selectable rowActions={() => patientActions()} />,
    );
    expect(screen.queryByTestId('patients-table-fold-toggle')).not.toBeInTheDocument();
    expect(headerLabels()).toHaveLength(7);
  });

  it('never folds a table that opts out — it keeps every column and scrolls', () => {
    scrollerWidth = 500;
    render(<Room data={[patient(8)]} />);
    expect(headerLabels()).toHaveLength(7);
    expect(screen.getByRole('table').style.getPropertyValue('--dt-min-w')).toMatch(/px$/);
    expect(screen.queryByTestId('patients-table-fold-toggle')).not.toBeInTheDocument();
  });

  it('shows the footer count, never "x of N"', () => {
    render(<Room data={[patient(1)]} countLabel="12 patients" />);
    expect(screen.getByTestId('patients-table-footer')).toHaveTextContent('12 patients');
  });
});

describe('DataTable — phone rows (below md)', () => {
  beforeEach(() => {
    viewport.tier = 'phone';
  });

  it('drops the header, footer and checkboxes; keeps Due as the key column', () => {
    render(
      <Room
        data={[patient(8)]}
        fold
        selectable
        countLabel="1 patient"
        rowActions={() => patientActions()}
      />,
    );
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
    expect(screen.queryByTestId('patients-table-footer')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

    const row = screen.getByTestId('patients-table-row');
    const cells = within(row).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Patient 008');
    expect(cells[1]).toHaveTextContent('₹2000');
    expect(cells[1]?.className).toContain('max-w-[46%]');
  });

  it('leads with the key column and ends with the primary block when keyFirst', () => {
    render(<Room data={[patient(8)]} fold phoneKeyFirst />);
    const cells = within(screen.getByTestId('patients-table-row')).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('₹2000');
    expect(cells[0]?.className).toContain('flex-1');
    expect(cells[1]).toHaveTextContent('Patient 008');
    expect(cells[1]?.className).toContain('max-w-[46%]');
    // The meta line stays with the primary cell, now at the end.
    expect(cells[1]?.querySelector('[data-slot="data-table-meta"]')).not.toBeNull();
  });

  it('caps the meta line at four, most important first, dropping "Active"', () => {
    const { unmount } = render(<Room data={[patient(8)]} fold />);
    const meta = screen.getByText('#3508').closest('[data-slot="data-table-meta"]');
    // Type, Status, Follow-up, then the id; Updated folds to nothing.
    expect(meta).toHaveTextContent(
      /^Type Aesthetic Status Regular Follow-up Sep 24 · 14:50 #3508$/,
    );
    unmount();

    render(<Room data={[patient(9, { status: 'Active' })]} fold />);
    const shorter = screen.getByText('#3509').closest('[data-slot="data-table-meta"]');
    expect(shorter).not.toHaveTextContent('Active');
    expect(shorter).toHaveTextContent(/^Type Aesthetic Follow-up Sep 24 · 14:50 #3509$/);
  });

  it('indents the meta line under an avatar: every row of a person column, or the rows that draw one', () => {
    const { unmount } = render(<Room data={[patient(8)]} fold />);
    expect(
      screen.getByText('#3508').closest('[data-slot="data-table-meta"]'),
    ).toHaveClass('ps-10.5');
    unmount();

    // A party column (Payments' From / to): a patient's chip, a supplier's name.
    const columns = PATIENT_COLUMNS.map((column) =>
      'accessorKey' in column && column.accessorKey === 'name'
        ? {
            ...column,
            meta: {
              track: 'minmax(200px,1.4fr)',
              primary: true,
              drawsAvatar: (row: unknown) => (row as Patient).type !== 'Supplier',
            },
          }
        : column,
    );
    function Parties() {
      const table = useTable({
        features: dataTableFeatures,
        data: [patient(8), patient(9, { type: 'Supplier' })],
        columns,
        getRowId: (row) => row.id,
      });
      return <DataTable table={table} tableId="parties" fold />;
    }
    render(<Parties />);
    const metaOf = (id: string) =>
      screen.getByText(id).closest('[data-slot="data-table-meta"]');
    expect(metaOf('#3508')).toHaveClass('ps-10.5');
    expect(metaOf('#3509')).not.toHaveClass('ps-10.5');
  });

  it('puts the row actions on their own end-aligned line with labelled primaries', () => {
    const actions = (): DataTableRowAction[] => [
      { id: 'open', label: 'Open file', icon: PenLine, onSelect: vi.fn(), primary: true },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash,
        onSelect: vi.fn(),
        destructive: true,
      },
    ];
    render(<Room data={[patient(8)]} fold rowActions={actions} />);
    const open = screen.getByTestId('patients-row-action-open');
    expect(open).toHaveTextContent('Open file');
    expect(open.closest('[role="cell"]')?.className).toContain('basis-full');
  });

  it('wraps every cell of a wrap table in order, with no meta line', () => {
    render(<Room data={[patient(8)]} phoneLayout="wrap" />);
    const cells = within(screen.getByTestId('patients-table-row')).getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent)).toEqual([
      '#3508',
      'Patient 008',
      'Aesthetic',
      'Regular',
      'Sep 24 · 14:50',
      '₹2000',
      'Riya S.',
    ]);
    expect(document.querySelector('[data-slot="data-table-meta"]')).toBeNull();
  });

  it('re-grids each cell with its phone classes, leaving out hidden ones', () => {
    const columns: ColumnDef<DataTableFeatures, Patient>[] = [
      {
        accessorKey: 'name',
        header: 'Patient',
        meta: { phoneClassName: 'col-start-2 row-start-1' },
      },
      { accessorKey: 'status', header: 'Status', meta: { phoneHidden: true } },
    ];
    function Regrid() {
      const table = useTable({
        features: dataTableFeatures,
        data: [patient(1)],
        columns,
      });
      return (
        <DataTable
          table={table}
          phoneLayout="regrid"
          phoneGridClassName="grid-cols-[60px_minmax(0,1fr)_auto]"
        />
      );
    }
    render(<Regrid />);
    const row = screen.getByTestId('data-table-row');
    expect(row.className).toContain('grid-cols-[60px_minmax(0,1fr)_auto]');
    const cells = within(row).getAllByRole('cell');
    expect(cells).toHaveLength(1);
    expect(cells[0]?.className).toContain('col-start-2 row-start-1');
  });

  it('has no accessibility violations on a phone', async () => {
    const { container } = render(
      <Room data={[patient(1), patient(2)]} fold rowActions={() => patientActions()} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DataTable — selection and the bulk bar (from md, D31)', () => {
  const three = [patient(1), patient(2), patient(3)];

  it('hides the row checkbox until hover, focus or any selection', () => {
    render(<Room data={three} selectable />);
    const box = screen.getByRole('checkbox', { name: 'Select Patient 001' });
    expect(box).not.toHaveAttribute('data-show');
    fireEvent.click(box);
    expect(screen.getByRole('checkbox', { name: 'Select Patient 002' })).toHaveAttribute(
      'data-show',
      'true',
    );
  });

  it('selects a range with shift, shows the tri-state header and "Select all <N>"', async () => {
    const user = userEvent.setup();
    render(<Room data={[...three, patient(4)]} selectable />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Patient 001' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Patient 003' }), {
      shiftKey: true,
    });
    const bar = screen.getByRole('toolbar', { name: 'Bulk actions' });
    expect(bar).toHaveTextContent('3 selected');
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );

    await user.click(within(bar).getByRole('button', { name: 'Select all 4' }));
    expect(bar).toHaveTextContent('4 selected');
    expect(within(bar).queryByRole('button', { name: /select all/i })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('runs a bulk action over the selected rows, and Esc or × clears', async () => {
    const user = userEvent.setup();
    const exportRows = vi.fn();
    render(
      <Room
        data={three}
        selectable
        bulkActions={[
          { id: 'export', label: 'Export', icon: Receipt, onSelect: exportRows },
        ]}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }));
    await user.click(screen.getByTestId('patients-table-bulk-export'));
    expect(exportRows).toHaveBeenCalledWith(three);

    // The Esc that clears the selection is handled: a page's own Esc (the
    // patient file going back, Q-F8) sees it taken.
    let escapeHandled: boolean | null = null;
    const watch = (event: KeyboardEvent) => {
      escapeHandled = event.defaultPrevented;
    };
    window.addEventListener('keydown', watch);
    await user.keyboard('{Escape}');
    window.removeEventListener('keydown', watch);
    expect(
      screen.queryByRole('toolbar', { name: 'Bulk actions' }),
    ).not.toBeInTheDocument();
    expect(escapeHandled).toBe(true);

    await user.click(screen.getByRole('checkbox', { name: 'Select Patient 002' }));
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(
      screen.queryByRole('toolbar', { name: 'Bulk actions' }),
    ).not.toBeInTheDocument();
  });

  it('never selects on a phone', () => {
    viewport.tier = 'phone';
    render(<Room data={three} selectable fold />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('has no accessibility violations with selection, actions and a fold', async () => {
    scrollerWidth = 794;
    const { container } = render(
      <Room data={three} fold selectable rowActions={() => patientActions()} />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Patient 001' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DataTable — rows', () => {
  it('opens a row on click or Enter, but not from its actions', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onAction = vi.fn();
    render(
      <Room
        data={[patient(1)]}
        onRowClick={onRowClick}
        rowActions={() => patientActions(onAction)}
      />,
    );
    const row = screen.getByTestId('patients-table-row');
    await user.click(row);
    expect(onRowClick).toHaveBeenCalledTimes(1);

    row.focus();
    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledTimes(2);

    await user.click(screen.getByTestId('patients-row-action-edit'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('paints the 3px status edge in the row’s tone', () => {
    render(<Room data={[patient(1)]} getRowTone={() => 'blush'} />);
    expect(screen.getByTestId('patients-table-row').className).toContain(
      'border-s-tone-blush-dot',
    );
  });

  it('keeps the actions sticky at the inline end, destructive last after a separator', () => {
    render(<Room data={[patient(1)]} rowActions={() => patientActions()} />);
    const edit = screen.getByTestId('patients-row-action-edit');
    const cell = edit.closest('[role="cell"]');
    expect(cell?.className).toContain('sticky');
    const buttons = within(cell as HTMLElement).getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'New invoice',
      'Collect ₹2,000',
      'Edit',
      'Delete',
    ]);
    expect(buttons[3]?.previousElementSibling).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('DataTable — length (D7)', () => {
  const many = (count: number) => Array.from({ length: count }, (_, i) => patient(i + 1));

  it('renders every row up to 60 and virtualises above it', () => {
    const { unmount } = render(<Room data={many(60)} />);
    expect(screen.getAllByTestId('patients-table-row')).toHaveLength(60);
    unmount();

    render(<Room data={many(200)} />);
    const rendered = screen.getAllByTestId('patients-table-row').length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThanOrEqual(21);
  });

  it('honours a lower threshold (Leads virtualise above 40)', () => {
    render(<Room data={many(45)} virtualizeAbove={40} />);
    expect(screen.getAllByTestId('patients-table-row').length).toBeLessThan(45);
  });

  it('ends with "All <records> loaded" once there is no next page', () => {
    const { rerender } = render(<Room data={many(3)} hasNextPage />);
    expect(screen.queryByTestId('patients-table-end')).not.toBeInTheDocument();
    rerender(<Room data={many(3)} />);
    const end = screen.getByTestId('patients-table-end');
    expect(end).toHaveTextContent('All patients loaded');
    // Under a short list it keeps to the card's foot: the scroller is a column
    // and the end line's group takes the space left (the prototype's filler).
    expect(end.parentElement).toHaveClass('mt-auto');
    expect(end.parentElement?.parentElement).toHaveClass('flex', 'flex-col');
  });

  it('shows "Loading more" while the next page loads', () => {
    render(<Room data={many(3)} hasNextPage isFetchingNextPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading more patients');
  });

  it('asks for the next page when the end of the list scrolls in', () => {
    const observers: { callback: IntersectionObserverCallback }[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          observers.push({ callback });
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const fetchNextPage = vi.fn();
    const { rerender } = render(
      <Room data={many(3)} hasNextPage fetchNextPage={fetchNextPage} />,
    );
    const latest = observers.at(-1);
    act(() => {
      latest?.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    const before = observers.length;
    rerender(
      <Room
        data={many(3)}
        hasNextPage
        isFetchingNextPage
        fetchNextPage={fetchNextPage}
      />,
    );
    expect(observers).toHaveLength(before);
  });
});

describe('DataTable — j / k (Leads)', () => {
  it('moves a row focus with j and k and opens it with Enter', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <Room
        data={[patient(1), patient(2), patient(3)]}
        keyboardNav
        onRowClick={onRowClick}
      />,
    );
    const rows = () => screen.getAllByTestId('patients-table-row');

    await user.keyboard('j');
    expect(rows()[0]).toHaveAttribute('data-kfocus', 'true');
    await user.keyboard('j');
    expect(rows()[1]).toHaveAttribute('data-kfocus', 'true');
    await user.keyboard('k');
    expect(rows()[0]).toHaveAttribute('data-kfocus', 'true');
    expect(rows()[1]).not.toHaveAttribute('data-kfocus');

    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0]?.[0].original).toEqual(patient(1));
  });

  it('ignores j and k while typing', async () => {
    const user = userEvent.setup();
    render(
      <>
        <input aria-label="Search" />
        <Room data={[patient(1)]} keyboardNav />
      </>,
    );
    await user.click(screen.getByRole('textbox', { name: 'Search' }));
    await user.keyboard('j');
    expect(screen.getByTestId('patients-table-row')).not.toHaveAttribute('data-kfocus');
  });

  it('stays off unless asked', async () => {
    const user = userEvent.setup();
    render(<Room data={[patient(1)]} />);
    await user.keyboard('j');
    expect(screen.getByTestId('patients-table-row')).not.toHaveAttribute('data-kfocus');
  });
});

describe('DataTable — row groups (the Agenda’s days)', () => {
  const groups = {
    keyOf: (data: Patient) => data.followUp,
    header: ({ key, rows }: { key: string; rows: readonly Patient[] }) => (
      <p>
        {key} · {rows.length}
      </p>
    ),
  };
  const visits = [
    patient(1, { followUp: 'Sat' }),
    patient(2, { followUp: 'Sat' }),
    patient(3, { followUp: 'Sun' }),
  ];

  it('heads each run of rows with its group, the headers sticky and in the row count', () => {
    render(<Room data={visits} groups={groups} />);
    // Without the column header and the "All patients loaded" line.
    const rows = screen.getAllByRole('row').slice(1, -1);
    expect(rows.map((row) => row.textContent)).toEqual([
      'Sat · 2',
      expect.stringContaining('Patient 001'),
      expect.stringContaining('Patient 002'),
      'Sun · 1',
      expect.stringContaining('Patient 003'),
    ]);
    const headers = rows.filter((row) => row.dataset.slot === 'data-table-group');
    expect(headers).toHaveLength(2);
    for (const header of headers) expect(header.className).toContain('sticky');
    // The column header, 3 rows and 2 group headers.
    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '6');
    expect(rows.map((row) => row.getAttribute('aria-rowindex'))).toEqual([
      '2',
      '3',
      '4',
      '5',
      '6',
    ]);
  });

  it('keeps j / k on rows, skipping the headers', async () => {
    const user = userEvent.setup();
    render(<Room data={visits} groups={groups} keyboardNav />);
    await user.keyboard('jjj');
    const focused = screen
      .getAllByTestId('patients-table-row')
      .find((row) => row.dataset.kfocus === 'true');
    expect(focused).toHaveTextContent('Patient 003');
  });

  it('pins the top group’s header while the list virtualises', () => {
    const many = Array.from({ length: 80 }, (_, index) =>
      patient(index + 1, { followUp: index < 70 ? 'Sat' : 'Sun' }),
    );
    const { container } = render(<Room data={many} groups={groups} />);
    const pinned = container.querySelector('[aria-hidden="true"].sticky');
    expect(pinned).toHaveTextContent('Sat · 70');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Room data={visits} groups={groups} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DataTable — refresh (KICKOFF §6.0)', () => {
  it('marks the table busy and pauses clicks while the rows are the previous params’', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const { rerender } = render(
      <Room data={[patient(1)]} onRowClick={onRowClick} refreshing />,
    );
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    // The rows' rowgroup carries the pause and the bars: the in-place skeleton
    // every room shares, one `index.css` rule (skeleton-in-place-css.test.ts).
    const rowgroup = screen
      .getByTestId('patients-table-row')
      .closest('[data-slot="data-table-body"]');
    expect(rowgroup).toHaveAttribute('data-refreshing', 'true');

    rerender(<Room data={[patient(1)]} onRowClick={onRowClick} />);
    expect(screen.getByRole('table')).not.toHaveAttribute('aria-busy');
    await user.click(screen.getByTestId('patients-table-row'));
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });
});
