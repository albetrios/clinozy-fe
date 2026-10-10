import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import {
  patientFile,
  TEST_CONTACT_ID,
  TEST_PATIENT_ID,
} from '@/tests/utils/patient-doubles.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { usePatientFileActions } from './usePatientFileActions.ts';

const FILE = `/organization/acme/patients/${TEST_PATIENT_ID}`;

/** Each item as a button, and each section's primary item. */
function ActionsProbe() {
  const { items, primaryFor } = usePatientFileActions();
  return (
    <div>
      {items.map((item) => (
        <button key={item.id} type="button" onClick={item.run}>
          {item.id}
        </button>
      ))}
      <output data-testid="primaries">
        {(
          [
            'visits',
            'prescriptions',
            'treatments',
            'images',
            'reports',
            'invoices',
            'payments',
            'timeline',
            'packages',
            'notes',
          ] as const
        )
          .map((section) => `${section}:${primaryFor(section)?.id ?? '-'}`)
          .join(' ')}
      </output>
    </div>
  );
}

/** Moves the visit `appt_next…`. */
function RescheduleProbe() {
  const { reschedule } = usePatientFileActions();
  return (
    <button
      type="button"
      onClick={() => reschedule({ appointmentId: 'appt_next00000000000000000' })}
    >
      reschedule
    </button>
  );
}

const itemIds = () =>
  screen
    .getAllByRole('button')
    .map((button) => button.textContent)
    .filter(Boolean);

/** End View-as: the member signed in, holding exactly these codes. */
function signedInWith(codes: OrganizationPermission[]) {
  act(() => {
    useUIStore.setState({ previewRole: null });
    useOrganizationStore.getState().setPermissions(['organization:read', ...codes]);
  });
}

afterEach(() => {
  resetPatientFile();
});

describe('usePatientFileActions', () => {
  it('offers the Owner the six items in the menu’s order — no Invoice or Payment', async () => {
    renderInPatientFile(<ActionsProbe />, { file: patientFile(), role: 'owner' });
    await screen.findByRole('button', { name: 'prescription' });
    expect(itemIds()).toEqual([
      'prescription',
      'treatment',
      'photo',
      'appointment',
      'report',
      'note',
    ]);
  });

  it('gives each section its own primary, and none to the billing sections', async () => {
    renderInPatientFile(<ActionsProbe />, { file: patientFile(), role: 'owner' });
    await screen.findByRole('button', { name: 'prescription' });
    expect(screen.getByTestId('primaries')).toHaveTextContent(
      [
        'visits:appointment',
        'prescriptions:prescription',
        'treatments:treatment',
        'images:photo',
        'reports:report',
        'invoices:-',
        'payments:-',
        'timeline:-',
        'packages:-',
        'notes:-',
      ].join(' '),
    );
  });

  it('gives a previewed Admin the Rx but not the treatment (S:35, 38; Owner always passes)', async () => {
    renderInPatientFile(<ActionsProbe />, { file: patientFile() });
    await screen.findByRole('button', { name: 'prescription' });
    expect(itemIds()).not.toContain('treatment');
  });

  it('keeps the Rx and treatment items to their named roles in View-as (S:35, 38)', async () => {
    renderInPatientFile(<ActionsProbe />, { file: patientFile(), role: 'front_desk' });
    await screen.findByRole('button', { name: 'appointment' });
    expect(itemIds()).toEqual(['photo', 'appointment', 'report', 'note']);
  });

  it('asks a signed-in member’s own codes for every item', async () => {
    renderInPatientFile(<ActionsProbe />, { file: patientFile() });
    await screen.findByRole('button', { name: 'prescription' });

    signedInWith(['patient:read']);
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'prescription' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryAllByRole('button')).toHaveLength(0);

    signedInWith(['patient:read', 'patient_treatment:create', 'appointment:create']);
    expect(await screen.findByRole('button', { name: 'treatment' })).toBeInTheDocument();
    expect(itemIds()).toEqual(['treatment', 'appointment']);

    signedInWith([
      'patient:read',
      'patient:create',
      'patient:update',
      'patient_prescription:create',
    ]);
    expect(
      await screen.findByRole('button', { name: 'prescription' }),
    ).toBeInTheDocument();
    expect(itemIds()).toEqual(['prescription', 'photo', 'report', 'note']);
  });

  it('opens a record’s drawer over its section', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<ActionsProbe />, {
      file: patientFile(),
      role: 'owner',
    });
    for (const [item, path] of [
      ['prescription', 'prescriptions/create'],
      ['treatment', 'treatments/create'],
      ['report', 'reports/create'],
    ] as const) {
      await user.click(await screen.findByRole('button', { name: item }));
      await waitFor(() => expect(router.state.location.pathname).toBe(`${FILE}/${path}`));
    }
  });

  it('books an appointment for the patient’s person', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<ActionsProbe />, { file: patientFile() });
    await user.click(await screen.findByRole('button', { name: 'appointment' }));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        '/organization/acme/appointments/create',
      ),
    );
    // `who=` the contact id — the booking is the person's.
    expect(shownLocation(router).search).toEqual({
      who: TEST_CONTACT_ID,
      from: `patients/${TEST_PATIENT_ID}/visits`,
    });
  });

  it('keeps the file behind the booking (A-P1)', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<ActionsProbe />, { file: patientFile() });
    await user.click(await screen.findByRole('button', { name: 'appointment' }));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        '/organization/acme/appointments/create',
      ),
    );
    expect(router.state.location.pathname).toBe(`${FILE}/visits`);
  });

  it('opens the photo picker for General, then Photos (KICKOFF §6.6 Add menu)', async () => {
    const user = userEvent.setup();
    const photos = { pick: vi.fn(), upload: vi.fn() };
    const { router } = renderInPatientFile(<ActionsProbe />, {
      file: patientFile(),
      photos,
    });
    await user.click(await screen.findByRole('button', { name: 'photo' }));
    expect(photos.pick).toHaveBeenCalledWith('general');
    await waitFor(() => expect(router.state.location.pathname).toBe(`${FILE}/images`));
  });

  it('opens Team notes for a note', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<ActionsProbe />, { file: patientFile() });
    await user.click(await screen.findByRole('button', { name: 'note' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${FILE}/notes`));
  });

  it('moves a booked visit: the appointment form in reschedule mode, the file behind it', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<RescheduleProbe />, {
      file: patientFile(),
      section: 'timeline',
    });
    await user.click(await screen.findByRole('button', { name: 'reschedule' }));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        '/organization/acme/appointments/appt_next00000000000000000',
      ),
    );
    expect(shownLocation(router).search).toEqual({
      mode: 'reschedule',
      from: `patients/${TEST_PATIENT_ID}/timeline`,
    });
  });

  it('moves a visit from outside a section with no way back', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<RescheduleProbe />, {
      file: patientFile(),
      section: null,
    });
    await user.click(await screen.findByRole('button', { name: 'reschedule' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/organization/acme/appointments/appt_next00000000000000000',
      ),
    );
    expect(router.state.location.search).toEqual({ mode: 'reschedule' });
  });
});
