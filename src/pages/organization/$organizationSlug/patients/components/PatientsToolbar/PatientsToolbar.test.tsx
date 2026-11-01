import { useTable } from '@tanstack/react-table';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { PatientRow } from '@/shared/api/app/patients-contracts.ts';
import { dataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PatientsToolbar, type PatientsToolbarProps } from './PatientsToolbar.tsx';

const NO_ROWS: PatientRow[] = [];

function Harness(props: Omit<PatientsToolbarProps, 'table'>) {
  const table = useTable({
    features: dataTableFeatures,
    data: NO_ROWS,
    columns: [
      { id: 'seq', header: 'ID', enableHiding: false },
      { id: 'name', header: 'Patient' },
    ],
  });
  return <PatientsToolbar table={table} {...props} />;
}

describe('PatientsToolbar', () => {
  it('draws the h1, the three view tabs with their icons, search, Filters, Columns and New patient', async () => {
    const { container } = renderWithProviders(
      <Harness view="all" onViewChange={vi.fn()} onNewPatient={vi.fn()} />,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Patients' }),
    ).toBeInTheDocument();
    const tabs = within(screen.getByRole('tablist', { name: 'Patient views' }));
    // In clinic today and With dues go: the API has no read for either.
    expect(tabs.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'All',
      'Follow-up due',
      'Recall',
    ]);
    expect(tabs.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    for (const tab of tabs.getAllByRole('tab')) {
      expect(tab.querySelector('svg')).not.toBeNull();
    }
    expect(screen.getByRole('searchbox', { name: 'Search patients' })).toHaveAttribute(
      'placeholder',
      'Name, mobile or #ID',
    );
    expect(screen.getByTestId('patients-filters-trigger')).toHaveTextContent('Filters');
    expect(screen.getByTestId('patients-columns-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('patients-new')).toHaveTextContent('New patient');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('changes the view and opens New patient', async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    const onNewPatient = vi.fn();
    renderWithProviders(
      <Harness view="all" onViewChange={onViewChange} onNewPatient={onNewPatient} />,
    );
    await user.click(await screen.findByTestId('patients-tab-follow'));
    await user.keyboard('{Enter}');
    expect(onViewChange).toHaveBeenCalledWith('follow');
    await user.click(screen.getByTestId('patients-new'));
    expect(onNewPatient).toHaveBeenCalledTimes(1);
  });

  it('hides New patient without Create', async () => {
    renderWithProviders(<Harness view="recall" onViewChange={vi.fn()} />);
    expect(await screen.findByTestId('patients-tab-recall')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByTestId('patients-new')).not.toBeInTheDocument();
  });

  it('lists the room’s filter sections in their order, each value in its tone — no Gender', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Harness view="all" onViewChange={vi.fn()} onNewPatient={vi.fn()} />,
    );
    await user.click(await screen.findByTestId('patients-filters-trigger'));
    const panel = await screen.findByTestId('patients-filters');
    const groups = within(panel).getAllByRole('group');
    const labelOf = (group: HTMLElement) =>
      document.getElementById(group.getAttribute('aria-labelledby') ?? '')?.textContent;
    expect(groups.map(labelOf)).toEqual([
      'Type',
      'Status',
      'Conversion',
      'Age',
      'Created',
      'Follow-up date',
    ]);
    expect(within(panel).queryByText('Female')).not.toBeInTheDocument();
    expect(within(panel).getByText('Gynac').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'butter',
    );
    expect(within(panel).getByText('T-Converted').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'sage',
    );
    // The API cannot read a follow-up that is not set.
    const followUp = groups.find((group) => labelOf(group) === 'Follow-up date');
    expect(followUp).toBeDefined();
    expect(within(followUp as HTMLElement).getByText('Overdue')).toBeInTheDocument();
    expect(
      within(followUp as HTMLElement).queryByText('Not set'),
    ).not.toBeInTheDocument();
  });
});
