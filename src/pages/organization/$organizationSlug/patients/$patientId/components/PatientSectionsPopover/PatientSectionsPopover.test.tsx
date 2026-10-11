import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  PATIENT_FILE_SECTIONS,
  type PatientFileSectionSlug,
  viewablePatientFileSections,
} from '@/shared/app/patient-file-sections.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import {
  PatientSectionsPopover,
  type PatientSectionsPopoverProps,
} from './PatientSectionsPopover.tsx';

/** The popover under its folder button, opened. */
function Harness(props: Partial<PatientSectionsPopoverProps>) {
  const [open, setOpen] = useState(true);
  return (
    <PatientSectionsPopover
      open={open}
      onOpenChange={setOpen}
      trigger={<button type="button">Sections</button>}
      patientName="Priya Shah"
      current="visits"
      viewable={PATIENT_FILE_SECTIONS}
      pins={['overview', 'visits']}
      onPick={vi.fn()}
      onTogglePin={vi.fn()}
      {...props}
    />
  );
}

const tile = (section: PatientFileSectionSlug) =>
  screen.getByTestId(`patient-file-sections-tile-${section}`);

describe('PatientSectionsPopover', () => {
  it('lays the sections out in their four groups, with the patient and the footer', async () => {
    const { baseElement } = renderWithProviders(<Harness />);
    const panel = await screen.findByTestId('patient-file-sections-panel');
    expect(panel).toHaveTextContent('Patient file');
    expect(panel).toHaveTextContent('Priya Shah');
    expect(panel).toHaveTextContent('Pinned sections stay in the bar');
    expect(
      within(panel)
        .getAllByRole('group')
        .map((group) => group.getAttribute('aria-label')),
    ).toEqual(['Clinical', 'Care', 'Billing', 'Team']);
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('marks the open section "Open now", and counts no section’s records', async () => {
    renderWithProviders(<Harness />);
    await screen.findByTestId('patient-file-sections-panel');
    expect(tile('visits')).toHaveTextContent('Open now');
    expect(tile('visits')).toHaveAttribute('aria-current', 'page');
    for (const section of PATIENT_FILE_SECTIONS.filter((slug) => slug !== 'visits')) {
      expect(tile(section)).not.toHaveAttribute('aria-current');
      expect(tile(section)).not.toHaveTextContent(/Open now|Empty|Has records/);
    }
  });

  it('marks no tile open over a drawer outside the sections', async () => {
    renderWithProviders(<Harness current={null} />);
    const panel = await screen.findByTestId('patient-file-sections-panel');
    expect(panel).not.toHaveTextContent('Open now');
  });

  it('pins and unpins from the bar, naming the section', async () => {
    const user = userEvent.setup();
    const onTogglePin = vi.fn();
    renderWithProviders(<Harness onTogglePin={onTogglePin} />);
    const pinned = await screen.findByTestId('patient-file-sections-pin-visits');
    expect(pinned).toHaveAttribute('aria-pressed', 'true');
    expect(pinned).toHaveAccessibleName('Unpin from bar · Visits');
    const unpinned = screen.getByTestId('patient-file-sections-pin-images');
    expect(unpinned).toHaveAccessibleName('Pin to bar · Photos');
    await user.click(unpinned);
    expect(onTogglePin).toHaveBeenCalledWith('images');
  });

  it('opens a section on a pick', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    renderWithProviders(<Harness onPick={onPick} />);
    await user.click(await screen.findByTestId('patient-file-sections-tile-notes'));
    expect(onPick).toHaveBeenCalledWith('notes');
  });

  it('leaves out the sections the member can’t open (an Accountant: Billing alone)', async () => {
    renderWithProviders(
      <Harness
        current="invoices"
        viewable={viewablePatientFileSections({ patients: false, billing: true })}
      />,
    );
    const panel = await screen.findByTestId('patient-file-sections-panel');
    expect(within(panel).getAllByRole('group')).toHaveLength(1);
    expect(within(panel).queryByTestId('patient-file-sections-tile-visits')).toBeNull();
  });
});
