import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchPatientFile } from '@/shared/api/clinic/patient-file-api.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import { PATIENT_FILE_SECTIONS } from '@/shared/clinic/patient-file-sections.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { Receipt } from '@/shared/icons/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PatientFileBar, type PatientFileBarProps } from './PatientFileBar.tsx';

const PINS = ['overview', 'visits', 'prescriptions', 'invoices'] as const;
let file: PatientFile;

function renderBar(props: Partial<PatientFileBarProps> = {}) {
  const handlers = {
    onTogglePin: vi.fn(),
    onOpenSection: vi.fn(),
    onBack: vi.fn(),
    onToggleActivity: vi.fn(),
  };
  const view = renderWithProviders(
    <TooltipProvider>
      <PatientFileBar
        file={file}
        section="visits"
        viewable={PATIENT_FILE_SECTIONS}
        pins={PINS}
        addItems={[]}
        activityOpen={false}
        {...handlers}
        {...props}
      />
    </TooltipProvider>,
  );
  return { ...view, ...handlers };
}

beforeAll(async () => {
  resetClinicFixtures();
  file = await fetchPatientFile(patientRef('Dharti Galani'));
});

describe('PatientFileBar', () => {
  it('draws Back, the name, the always-masked identity line and the pinned tabs', async () => {
    const { container } = renderBar({ file: { ...file, unread: 0 } });
    const back = await screen.findByTestId('patient-file-back');
    expect(back).toHaveAccessibleName('Back to patients');
    // The breadcrumb's heading and the identity block's — CSS shows one per tier.
    expect(
      screen.getAllByRole('heading', { level: 1, name: 'Dharti Galani' }),
    ).toHaveLength(2);
    expect(screen.getByText('#3508 · +91 ••••• •3212')).toBeInTheDocument();
    const tablist = screen.getByRole('tablist', { name: 'Patient sections' });
    expect(
      within(tablist)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Clinical notes', 'Visits', 'Prescriptions', 'Invoices']);
    expect(screen.getByTestId('patient-file-tab-visits')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('goes back from the button and from the breadcrumb', async () => {
    const user = userEvent.setup();
    const { onBack } = renderBar();
    await user.click(await screen.findByTestId('patient-file-back'));
    await user.click(screen.getByRole('button', { name: 'Patients' }));
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it('opens a tab on click, and the next or previous one with the arrow keys', async () => {
    const user = userEvent.setup();
    const { onOpenSection } = renderBar();
    await user.click(await screen.findByTestId('patient-file-tab-invoices'));
    expect(onOpenSection).toHaveBeenLastCalledWith('invoices');
    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onOpenSection).toHaveBeenLastCalledWith('prescriptions');
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onOpenSection).toHaveBeenLastCalledWith('overview');
    // Only the open tab is in the Tab order.
    expect(screen.getByTestId('patient-file-tab-visits')).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(screen.getByTestId('patient-file-tab-overview')).toHaveAttribute(
      'tabindex',
      '-1',
    );
  });

  it('marks an open section that is not pinned with its dot', async () => {
    renderBar({ section: 'images' });
    const tab = await screen.findByTestId('patient-file-tab-images');
    expect(tab).toHaveTextContent('Not pinned · shown while open');
  });

  it('shows the unread count on Activity while closed, and presses it while open', async () => {
    const closed = renderBar({ file: { ...file, unread: 3 } });
    const toggle = await screen.findByTestId('patient-file-activity');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAccessibleName('Show messages & activity');
    expect(within(toggle).getByText('3 unread messages')).toBeInTheDocument();
    await userEvent.setup().click(toggle);
    expect(closed.onToggleActivity).toHaveBeenCalledOnce();
    closed.unmount();

    renderBar({ file: { ...file, unread: 3 }, activityOpen: true });
    const open = await screen.findByTestId('patient-file-activity');
    expect(open).toHaveAttribute('aria-pressed', 'true');
    expect(open).toHaveAccessibleName('Hide messages & activity');
    expect(within(open).queryByText('3 unread messages')).not.toBeInTheDocument();
  });

  it('shows "+", Start visit and the visit pill only when there is something to do', async () => {
    const user = userEvent.setup();
    const bare = renderBar();
    await screen.findByTestId('patient-file-back');
    expect(screen.queryByTestId('patient-file-add')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patient-file-start-visit')).not.toBeInTheDocument();
    expect(screen.queryByText('Visit in progress · Resume')).not.toBeInTheDocument();
    bare.unmount();

    const run = vi.fn();
    const onStartVisit = vi.fn();
    const onResumeVisit = vi.fn();
    renderBar({
      addItems: [{ id: 'invoice', tone: 'butter', icon: Receipt, run }],
      onStartVisit,
      onResumeVisit,
    });
    await user.click(await screen.findByTestId('patient-file-start-visit'));
    expect(onStartVisit).toHaveBeenCalledOnce();
    await user.click(screen.getByText('Visit in progress · Resume'));
    expect(onResumeVisit).toHaveBeenCalledOnce();
    await user.click(screen.getByTestId('patient-file-add'));
    await user.click(await screen.findByTestId('patient-file-add-menu-invoice'));
    expect(run).toHaveBeenCalledOnce();
  });

  it('opens the sections popover and closes it on a pick', async () => {
    const user = userEvent.setup();
    const { onOpenSection } = renderBar();
    await user.click(await screen.findByTestId('patient-file-sections'));
    const panel = await screen.findByTestId('patient-file-sections-panel');
    await user.click(within(panel).getByTestId('patient-file-sections-tile-reports'));
    expect(onOpenSection).toHaveBeenCalledWith('reports');
    await waitFor(() =>
      expect(screen.queryByTestId('patient-file-sections-panel')).not.toBeInTheDocument(),
    );
  });
});
