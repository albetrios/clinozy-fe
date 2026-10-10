import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { patientFile, TEST_CONTACT_ID } from '@/tests/utils/patient-doubles.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { PatientSection } from './PatientSection.tsx';

const file = patientFile();

afterEach(() => {
  resetPatientFile();
});

describe('PatientSection', () => {
  it('heads the section with its title and its split "New …"', async () => {
    const { container } = renderInPatientFile(
      <PatientSection section="visits" data-testid="patient-section-visits">
        <p>the visits</p>
      </PatientSection>,
      { file },
    );
    const section = await screen.findByTestId('patient-section-visits');
    expect(section).toHaveAccessibleName('Visits');
    expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Visits',
    );
    expect(await screen.findByTestId('patient-section-primary')).toHaveTextContent(
      'New appointment',
    );
    expect(screen.getByText('the visits')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('runs its own item, and opens the Add menu for this patient from "⌄"', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(
      <PatientSection section="visits" data-testid="patient-section-visits" />,
      { file },
    );
    const more = await screen.findByTestId('patient-section-more');
    expect(more).toHaveAccessibleName('More for Priya');
    await user.click(more);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('For Priya · already selected')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByTestId('patient-section-primary'));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        '/organization/acme/appointments/create',
      ),
    );
    // The booking is the patient's person's.
    expect(shownLocation(router).search).toMatchObject({ who: TEST_CONTACT_ID });
  });

  it('takes a primary the Add menu has no item for (Add package)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderInPatientFile(
      <PatientSection
        section="packages"
        data-testid="patient-section-packages"
        primary={{ label: 'Add package', onSelect }}
      />,
      { file, section: 'packages' },
    );
    await user.click(await screen.findByTestId('patient-section-primary'));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('has no "New …" where the member may not add one', async () => {
    renderInPatientFile(
      <PatientSection
        section="prescriptions"
        data-testid="patient-section-prescriptions"
      />,
      { file, role: 'therapist', section: 'prescriptions' },
    );
    await screen.findByTestId('patient-section-prescriptions');
    // Give the access matrix its turn, then check.
    await waitFor(() =>
      expect(screen.queryByTestId('patient-section-primary')).not.toBeInTheDocument(),
    );
  });

  it('offers "New invoice" on Invoices with payment:create, and none without it', async () => {
    const { unmount } = renderInPatientFile(
      <PatientSection section="invoices" data-testid="patient-section-invoices" />,
      { file, role: 'owner', section: 'invoices' },
    );
    expect(await screen.findByTestId('patient-section-primary')).toHaveTextContent(
      'New invoice',
    );
    unmount();
    renderInPatientFile(
      <PatientSection section="invoices" data-testid="patient-section-invoices" />,
      { file, role: 'doctor', section: 'invoices' },
    );
    await screen.findByTestId('patient-section-invoices');
    await waitFor(() =>
      expect(screen.queryByTestId('patient-section-primary')).not.toBeInTheDocument(),
    );
  });

  it('waits for the file before offering its "New …"', async () => {
    renderInPatientFile(
      <PatientSection section="visits" data-testid="patient-section-visits" />,
      { file: undefined },
    );
    expect(await screen.findByTestId('patient-section-visits')).toHaveAccessibleName(
      'Visits',
    );
    expect(screen.queryByTestId('patient-section-primary')).not.toBeInTheDocument();
  });

  it('keeps only a heading for screen readers when headerless (the Overview)', async () => {
    renderInPatientFile(
      <PatientSection
        section="timeline"
        data-testid="patient-section-timeline"
        hideHeader
      />,
      { file, section: 'timeline' },
    );
    const heading = await screen.findByRole('heading', { level: 2, name: 'Overview' });
    expect(heading).toHaveClass('sr-only');
    expect(screen.queryByTestId('patient-section-primary')).not.toBeInTheDocument();
  });
});
