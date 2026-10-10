import { type ColumnDef, useTable } from '@tanstack/react-table';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import {
  type DataTableFeatures,
  dataTableFeatures,
} from '@/shared/components/DataTable/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import type { StaffChip } from '../../hooks/useStaffLookup/index.ts';
import { EmptyCell, StaffCell, TeamCell, UpdatedCell } from './patient-table-cells.tsx';
import { PatientSectionTable } from './PatientSectionTable.tsx';

const { exportMock, notifyMock } = vi.hoisted(() => ({
  exportMock: vi.fn(),
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/components/DataTable/data-table-csv.ts', () => ({
  exportTableCsv: exportMock,
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

interface Visit {
  id: string;
  when: string;
  doctor: StaffChip | null;
}

const DRASHTI: StaffChip = {
  id: 'mem_drashti00000000000000',
  name: 'Dr. Drashti Moradiya',
  initials: 'DM',
  tone: 'sky',
};
const VISITS: Visit[] = [
  { id: 'appt_visitone00000000000000', when: 'Today · 11:00', doctor: DRASHTI },
  { id: 'appt_visittwo00000000000000', when: 'Sep 24 · 14:50', doctor: null },
];

/** A two-column table as the sections build theirs: When, and the doctor's pill folding to nothing. */
function VisitsProbe({ rows, loading = false }: { rows: Visit[]; loading?: boolean }) {
  const columns: ColumnDef<DataTableFeatures, Visit>[] = [
    {
      id: 'when',
      accessorKey: 'when',
      header: 'When',
      enableSorting: false,
      meta: { track: '180px', primary: true },
    },
    {
      id: 'doctor',
      accessorFn: (row) => row.doctor?.name ?? '',
      header: 'Doctor',
      enableSorting: false,
      cell: ({ row }) => <StaffCell person={row.original.doctor} />,
      meta: { track: '180px', foldValue: () => null },
    },
  ];
  const table = useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => row.id,
  });
  return (
    <PatientSectionTable
      section="visits"
      table={table}
      loading={loading}
      countLabel={rows.length ? `${rows.length} appointments` : undefined}
      minWidth={760}
      rowTone={(row) => (row.doctor ? 'sky' : undefined)}
    />
  );
}

beforeEach(() => {
  exportMock.mockReset();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});
afterEach(() => {
  resetPatientFile();
});

describe('PatientSectionTable (KICKOFF §6.6 Section tables)', () => {
  it('lists the rows with the count and "All appointments loaded"', async () => {
    const { container } = renderInPatientFile(<VisitsProbe rows={VISITS} />, {
      role: 'admin',
    });
    expect(await screen.findAllByTestId('patient-visits-table-row')).toHaveLength(2);
    expect(screen.getByText('2 appointments')).toBeInTheDocument();
    expect(screen.getByText('All appointments loaded')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the section’s empty state when there are no rows', async () => {
    renderInPatientFile(<VisitsProbe rows={[]} />);
    expect(await screen.findByText('No appointments yet')).toBeInTheDocument();
  });

  it('exports the selected rows as CSV, a person cell as its name', async () => {
    const user = userEvent.setup();
    renderInPatientFile(<VisitsProbe rows={VISITS} />, { role: 'admin' });
    await user.click(await screen.findByTestId('patient-visits-table-select-all'));
    await user.click(await screen.findByTestId('patient-visits-table-bulk-export'));
    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    const [{ fileName, rows, cell }] = exportMock.mock.calls[0] as [
      {
        fileName: string;
        rows: Visit[];
        cell: (columnId: string, row: Visit) => string | undefined;
      },
    ];
    expect(fileName).toBe('visits.csv');
    expect(rows).toHaveLength(2);
    expect(cell('doctor', VISITS[0] as Visit)).toBe('Dr. Drashti Moradiya');
    expect(cell('when', VISITS[0] as Visit)).toBeUndefined();
    expect(notifyMock.success).toHaveBeenCalledWith('2 rows exported as CSV');
  });

  it('offers no Export to a member without the export ability', async () => {
    const user = userEvent.setup();
    renderInPatientFile(<VisitsProbe rows={VISITS} />, { role: 'front_desk' });
    await user.click(await screen.findByTestId('patient-visits-table-select-all'));
    expect(
      screen.queryByTestId('patient-visits-table-bulk-export'),
    ).not.toBeInTheDocument();
  });
});

describe('the section tables’ cells', () => {
  it('draws a person’s pill with the short name, a team as avatars, "—" for nobody', () => {
    render(
      <>
        <span data-testid="one">
          <StaffCell person={DRASHTI} />
        </span>
        <span data-testid="team">
          <TeamCell
            people={[
              DRASHTI,
              { ...DRASHTI, id: 'mem_kiran000000000000000', name: 'Kiran Patel' },
            ]}
          />
        </span>
        <span data-testid="nobody">
          <StaffCell person={null} />
          <TeamCell people={[]} />
          <EmptyCell />
        </span>
      </>,
    );
    expect(screen.getByTestId('one')).toHaveTextContent('Dr. Drashti');
    expect(
      within(screen.getByTestId('team')).getByText('Kiran Patel'),
    ).toBeInTheDocument();
    expect(within(screen.getByTestId('nobody')).getAllByText('—')).toHaveLength(3);
  });

  it('reads who wrote a record and when in the Updated cell', () => {
    render(<UpdatedCell person={DRASHTI} at="2026-09-24T09:20:00.000Z" />);
    expect(screen.getByText('Dr. Drashti')).toBeInTheDocument();
    // A week or more back: the date alone (the rooms' one time rule).
    expect(screen.getByText(/Sep 24/)).toBeInTheDocument();
  });
});
