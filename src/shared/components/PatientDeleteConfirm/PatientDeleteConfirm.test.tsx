import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as PatientsApiModule from '@/shared/api/clinic/patients-api.ts';
import { deletePatient, restorePatient } from '@/shared/api/clinic/patients-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { patientRecord, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PatientDeleteConfirm } from './PatientDeleteConfirm.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** Whether Dharti's file is live on the server double — a delete takes it, a restore brings it back. */
const server = vi.hoisted(() => ({ live: true }));
vi.mock('@/shared/api/clinic/patients-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PatientsApiModule>()),
  deletePatient: vi.fn(async () => {
    server.live = false;
  }),
  restorePatient: vi.fn(async (patientId: string) => {
    server.live = true;
    return patientRecord({ id: patientId });
  }),
}));

const DHARTI = TEST_PATIENT_ID;
const isLive = () => server.live;

beforeEach(() => {
  viewport.tier = 'desktop';
  server.live = true;
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(deletePatient).mockClear();
  vi.mocked(restorePatient).mockClear();
  signInTestMember();
});
afterEach(() => {
  useOrganizationStore.getState().clearOrganization();
});

describe('PatientDeleteConfirm', () => {
  it('asks with the patient in a pill, removes them with the reason, and offers Undo', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    renderWithProviders(
      <PatientDeleteConfirm
        patient={{ id: DHARTI, name: 'Dharti Galani' }}
        onClose={onClose}
        onDeleted={onDeleted}
      />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this patient?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'Dharti Galani',
    );
    expect(await axeForDialog(dialog)).toHaveNoViolations();

    await user.click(within(dialog).getByTestId('confirm-reason-not-needed'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
    expect(deletePatient).toHaveBeenCalledWith({
      patientId: DHARTI,
      reason: 'not_needed',
      note: null,
    });
    expect(isLive()).toBe(false);
  });

  it('restores the patient from the toast’s Undo', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PatientDeleteConfirm
        patient={{ id: DHARTI, name: 'Dharti Galani' }}
        onClose={vi.fn()}
      />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(notifyMock.undo).toHaveBeenCalledTimes(1));
    expect(notifyMock.undo).toHaveBeenCalledWith('Dharti Galani removed', {
      onUndo: expect.any(Function),
    });
    expect(isLive()).toBe(false);
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() => expect(isLive()).toBe(true));
    expect(restorePatient).toHaveBeenCalledWith(DHARTI, expect.any(String));
  });

  it('reads "Delete this record?" from the file, the drawer’s summary in the pill', async () => {
    renderWithProviders(
      <PatientDeleteConfirm
        fromFile
        patient={{
          id: DHARTI,
          name: 'Dharti Galani',
          record: 'Dharti Galani · Aesthetic · +91 82006 03212',
        }}
        onClose={vi.fn()}
      />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this record?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'Dharti Galani · Aesthetic · +91 82006 03212',
    );
  });

  it('keeps the patient on "Keep it"', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <PatientDeleteConfirm
        patient={{ id: DHARTI, name: 'Dharti Galani' }}
        onClose={onClose}
      />,
    );
    await user.click(await screen.findByTestId('confirm-cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(deletePatient).not.toHaveBeenCalled();
    expect(isLive()).toBe(true);
  });

  it('is closed while no patient is set', async () => {
    const { router } = renderWithProviders(
      <PatientDeleteConfirm patient={null} onClose={vi.fn()} />,
    );
    await router.load();
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
  });
});
