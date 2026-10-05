import { useTable } from '@tanstack/react-table';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { PatientRow } from '@/shared/api/clinic/patients-contracts.ts';
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
  it('draws the h1, the five view tabs with their icons, search, Filters, Columns and New patient', async () => {
    const { container } = renderWithProviders(
      <Harness view="all" onViewChange={vi.fn()} onNewPatient={vi.fn()} />,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Patients' }),
    ).toBeInTheDocument();
    const tabs = within(screen.getByRole('tablist', { name: 'Patient views' }));
    expect(tabs.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'All',
      'In clinic today',
      'With dues',
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
    renderWithProviders(<Harness view="dues" onViewChange={vi.fn()} />);
    expect(await screen.findByTestId('patients-tab-dues')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByTestId('patients-new')).not.toBeInTheDocument();
  });

  it('lists the room’s filter sections in their order, each value in its tone', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Harness view="all" onViewChange={vi.fn()} onNewPatient={vi.fn()} />,
    );
    await user.click(await screen.findByTestId('patients-filters-trigger'));
    const panel = await screen.findByTestId('patients-filters');
    const groups = within(panel).getAllByRole('group');
    expect(
      groups.map(
        (group) =>
          document.getElementById(group.getAttribute('aria-labelledby') ?? '')
            ?.textContent,
      ),
    ).toEqual(['Gender', 'Type', 'Status', 'Conversion', 'Created', 'Follow-up date']);
    expect(within(panel).getByText('Female').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'blush',
    );
    expect(within(panel).getByText('Gynac').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'butter',
    );
    expect(within(panel).getByText('T-Converted').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'sage',
    );
  });
});
