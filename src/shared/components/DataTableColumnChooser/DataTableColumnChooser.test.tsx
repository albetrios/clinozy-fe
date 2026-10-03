import { type ColumnDef, useTable } from '@tanstack/react-table';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import { useHiddenColumns } from '@/shared/hooks/useHiddenColumns/index.ts';
import {
  LEAD_CHAT_WIDTH,
  useDevicePrefsStore,
} from '@/shared/store/useDevicePrefsStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { DataTableColumnChooser } from './DataTableColumnChooser.tsx';

type Row = Record<string, string>;

const PATIENT_COLUMNS: ColumnDef<DataTableFeatures, Row>[] = [
  { accessorKey: 'id', header: 'ID', enableHiding: false },
  { accessorKey: 'name', header: 'Patient' },
  { accessorKey: 'gender', header: 'Gender', meta: { defaultHidden: true } },
  { accessorKey: 'age', header: 'Age', meta: { defaultHidden: true } },
  { accessorKey: 'type', header: 'Type' },
];

function Harness({
  columns = PATIENT_COLUMNS,
}: {
  columns?: ColumnDef<DataTableFeatures, Row>[];
}) {
  const visibility = useHiddenColumns('patients', columns);
  const table = useTable({
    features: dataTableFeatures,
    data: [],
    columns,
    state: { columnVisibility: visibility.columnVisibility },
    onColumnVisibilityChange: visibility.onColumnVisibilityChange,
  });
  return <DataTableColumnChooser table={table} tableId="patients" />;
}

beforeEach(() => {
  useDevicePrefsStore.setState({
    hiddenColumns: {},
    savedViews: {},
    photoSize: 'medium',
    leadChatWidth: LEAD_CHAT_WIDTH.initial,
  });
});

const option = (name: string) =>
  screen.getByRole('option', { name: new RegExp(`^${name}`) });

describe('DataTableColumnChooser', () => {
  it('counts the hidden columns on its 36px Eye button', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Show or hide columns' });
    expect(trigger).toHaveAttribute('title', 'Columns · 2 of 4 shown');
    expect(trigger).toHaveTextContent('2');
    expect(trigger.className).toContain('max-md:hidden');
  });

  it('lists "Show all columns" first, then each hideable column', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Show or hide columns' }));

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('Show all columns Recommended set hides 2');
    expect(options.slice(1).map((item) => item.textContent)).toEqual([
      'Patient',
      'Gender',
      'Age',
      'Type',
    ]);
    expect(option('Gender')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('2 of 4 shown')).toBeInTheDocument();
  });

  it('persists a toggled column on this device', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Show or hide columns' }));
    await user.click(option('Gender'));

    expect(option('Gender')).toHaveAttribute('aria-checked', 'true');
    expect(useDevicePrefsStore.getState().hiddenColumns.patients).toEqual(['age']);
  });

  it('shows everything, then returns to the recommended set on a second tap', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Show or hide columns' }));

    await user.click(option('Show all columns'));
    expect(useDevicePrefsStore.getState().hiddenColumns.patients).toEqual([]);
    expect(option('Show all columns')).toHaveTextContent(
      'Tap again for the recommended set',
    );
    expect(
      screen.queryByRole('button', { name: 'Show or hide columns' }),
    ).not.toHaveTextContent(/\d/);

    await user.click(option('Show all columns'));
    expect(useDevicePrefsStore.getState().hiddenColumns.patients).toEqual([
      'gender',
      'age',
    ]);
  });

  it('counts columns instead when the table has no recommended set', async () => {
    const user = userEvent.setup();
    const plain: ColumnDef<DataTableFeatures, Row>[] = [
      { accessorKey: 'status', header: 'Status' },
      { accessorKey: 'source', header: 'Source' },
    ];
    render(<Harness columns={plain} />);
    await user.click(screen.getByRole('button', { name: 'Show or hide columns' }));
    expect(option('Show all columns')).toHaveTextContent('All 2 columns shown');
    await user.click(option('Source'));
    expect(option('Show all columns')).toHaveTextContent('1 hidden');
  });

  it('searches the list only above eight columns', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 9 }, (_, index) => ({
      accessorKey: `column${'abcdefghi'[index]}`,
      header: `Column ${'ABCDEFGHI'[index]}`,
    })) satisfies ColumnDef<DataTableFeatures, Row>[];
    render(<Harness columns={many} />);
    await user.click(screen.getByRole('button', { name: 'Show or hide columns' }));
    const search = screen.getByPlaceholderText('Search columns');
    await user.type(search, 'column c');
    const listbox = screen.getByRole('listbox');
    // "Show all columns" stays first; the columns narrow by name.
    expect(
      within(listbox)
        .getAllByRole('option')
        .slice(1)
        .map((item) => item.textContent),
    ).toEqual(['Column C']);

    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByText('No columns match')).toBeInTheDocument();
  });

  it('has no search box at eight columns or fewer', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Show or hide columns' }));
    expect(screen.queryByPlaceholderText('Search columns')).not.toBeInTheDocument();
  });

  it('has no accessibility violations while open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Show or hide columns' }));
    expect(await axeForDialog(screen.getByRole('dialog'))).toHaveNoViolations();
  });
});
