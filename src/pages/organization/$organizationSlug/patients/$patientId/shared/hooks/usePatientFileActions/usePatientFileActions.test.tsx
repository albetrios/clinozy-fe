import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchPatientFile } from '@/shared/api/clinic/patient-file-api.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { usePatientFileActions } from './usePatientFileActions.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const DHARTI = patientRef('Dharti Galani');
let file: PatientFile;

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
        {(['visits', 'images', 'timeline', 'packages', 'notes'] as const)
          .map((section) => `${section}:${primaryFor(section)?.id ?? '-'}`)
          .join(' ')}
      </output>
    </div>
  );
}

/** Moves the visit `A1`. */
function RescheduleProbe() {
  const { reschedule } = usePatientFileActions();
  return (
    <button type="button" onClick={() => reschedule({ appointmentId: 'A1' })}>
      reschedule
    </button>
  );
}

const itemIds = () =>
  screen
    .getAllByRole('button')
    .map((button) => button.textContent)
    .filter(Boolean);

beforeEach(async () => {
  notifyMock.info.mockReset();
  resetClinicFixtures();
  file = await fetchPatientFile(DHARTI);
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('usePatientFileActions', () => {
  it('offers the Owner the eight items in the menu’s order, each section its own', async () => {
    renderInPatientFile(<ActionsProbe />, { file, role: 'owner' });
    await screen.findByRole('button', { name: 'prescription' });
    expect(itemIds()).toEqual([
      'prescription',
      'treatment',
      'invoice',
      'payment',
      'photo',
      'appointment',
      'report',
      'note',
    ]);
    expect(screen.getByTestId('primaries')).toHaveTextContent(
      'visits:appointment images:photo timeline:- packages:- notes:-',
    );
  });

  it('gives an Admin the Rx but not the treatment (S:35, 38; Owner always passes)', async () => {
    renderInPatientFile(<ActionsProbe />, { file });
    await screen.findByRole('button', { name: 'prescription' });
    expect(itemIds()).not.toContain('treatment');
  });

  it('keeps the Rx and treatment items to their named roles (S:35, 38)', async () => {
    renderInPatientFile(<ActionsProbe />, { file, role: 'front_desk' });
    await screen.findByRole('button', { name: 'invoice' });
    expect(itemIds()).not.toContain('prescription');
    expect(itemIds()).not.toContain('treatment');
  });

  it('opens a record’s drawer over its section, and the invoice drawer keeping the file behind it', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<ActionsProbe />, { file, role: 'owner' });
    for (const [item, path] of [
      ['prescription', 'prescriptions/create'],
      ['treatment', 'treatments/create'],
      ['report', 'reports/create'],
    ] as const) {
      await user.click(await screen.findByRole('button', { name: item }));
      await waitFor(() =>
        expect(router.state.location.pathname).toBe(
          `/organization/acme/patients/${DHARTI}/${path}`,
        ),
      );
    }

    await user.click(screen.getByRole('button', { name: 'invoice' }));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe('/organization/acme/invoices/create'),
    );
    // Over the file's section, which stays behind it (A-P1).
    expect(router.state.location.pathname).toBe(
      `/organization/acme/patients/${DHARTI}/visits`,
    );
    expect(shownLocation(router).search).toEqual({
      type: 'clinic',
      patient: DHARTI,
      from: `patients/${DHARTI}/visits`,
    });
  });

  it('books an appointment for this patient', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<ActionsProbe />, { file });
    await user.click(await screen.findByRole('button', { name: 'appointment' }));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        '/organization/acme/appointments/create',
      ),
    );
    expect(shownLocation(router).search).toMatchObject({ who: DHARTI });
    expect(router.state.location.pathname).toBe(
      `/organization/acme/patients/${DHARTI}/visits`,
    );
  });

  it('says "Nothing due" for a payment when nothing is owed, else opens Receive payment', async () => {
    const user = userEvent.setup();
    const paid = renderInPatientFile(<ActionsProbe />, { file: { ...file, due: 0 } });
    await user.click(await screen.findByRole('button', { name: 'payment' }));
    expect(notifyMock.info).toHaveBeenCalledWith('Nothing due for Dharti Galani');
    expect(paid.router.state.location.pathname).toBe(
      `/organization/acme/patients/${DHARTI}/visits`,
    );
    paid.unmount();

    const { router } = renderInPatientFile(<ActionsProbe />, {
      file: { ...file, due: 120_000 },
    });
    await user.click(await screen.findByRole('button', { name: 'payment' }));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe('/organization/acme/payments/receive'),
    );
    expect(shownLocation(router).search).toEqual({
      patient: DHARTI,
      from: `patients/${DHARTI}/visits`,
    });
    expect(router.state.location.pathname).toBe(
      `/organization/acme/patients/${DHARTI}/visits`,
    );
  });

  it('opens the photo picker for General, then Photos (KICKOFF §6.6 Add menu)', async () => {
    const user = userEvent.setup();
    const photos = { pick: vi.fn(), upload: vi.fn() };
    const { router } = renderInPatientFile(<ActionsProbe />, { file, photos });
    await user.click(await screen.findByRole('button', { name: 'photo' }));
    expect(photos.pick).toHaveBeenCalledWith('general');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/organization/acme/patients/${DHARTI}/images`,
      ),
    );
  });

  it('moves a booked visit: the appointment form in reschedule mode, the file behind it', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<RescheduleProbe />, {
      file,
      section: 'timeline',
    });
    await user.click(await screen.findByRole('button', { name: 'reschedule' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/appointments/A1'),
    );
    expect(router.state.location.search).toEqual({
      mode: 'reschedule',
      from: `patients/${DHARTI}/timeline`,
    });
  });

  it('moves a visit from outside a section with no way back', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<RescheduleProbe />, { file, section: null });
    await user.click(await screen.findByRole('button', { name: 'reschedule' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/appointments/A1'),
    );
    expect(router.state.location.search).toEqual({ mode: 'reschedule' });
  });
});
