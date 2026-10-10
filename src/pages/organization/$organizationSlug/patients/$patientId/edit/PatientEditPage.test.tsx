import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchPersonAppointments } from '@/shared/api/clinic/appointments-api.ts';
import { findContactByPhone } from '@/shared/api/clinic/contacts-api.ts';
import {
  deletePatient,
  fetchPatient,
  updatePatient,
} from '@/shared/api/clinic/patients-api.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import {
  patientFile,
  patientRecord,
  TEST_PATIENT_ID,
} from '@/tests/utils/patient-doubles.ts';

import {
  patientFileUrl,
  renderInPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';
import { PatientEditPage } from './PatientEditPage.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/hooks/useUploadQueue/index.ts', () => ({
  useUploadQueue: () => ({ enqueue: vi.fn() }),
}));
vi.mock('@/shared/api/clinic/patients-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPatient: vi.fn(),
  updatePatient: vi.fn(),
  deletePatient: vi.fn(),
}));
vi.mock('@/shared/api/clinic/contacts-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findContactByPhone: vi.fn(),
}));
// The Visits section behind the drawer reads the person's bookings.
vi.mock('@/shared/api/clinic/appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPersonAppointments: vi.fn(),
}));

const LIST = '/organization/acme/patients';

/** Edit patient at `?from=<from>`, the file loaded (or not), the dialog's URL the only entry. */
async function openEdit(from: string, { loaded = true }: { loaded?: boolean } = {}) {
  const view = renderInPatientFile(<PatientEditPage />, {
    file: loaded ? patientFile() : undefined,
  });
  await act(() =>
    view.router.navigate({
      href: `${patientFileUrl(TEST_PATIENT_ID, '/edit')}?from=${from}`,
      replace: true,
    }),
  );
  return view;
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(fetchPersonAppointments).mockResolvedValue([]);
  vi.mocked(findContactByPhone).mockResolvedValue(null);
  vi.mocked(fetchPatient).mockResolvedValue(patientRecord());
  vi.mocked(updatePatient).mockImplementation(async ({ record, fields }) => ({
    ...record,
    firstName: fields.firstName,
    lastName: fields.lastName,
    name: `${fields.firstName} ${fields.lastName ?? ''}`.trim(),
  }));
  vi.mocked(deletePatient).mockResolvedValue(undefined);
});
afterEach(() => {
  resetPatientFile();
});

describe('PatientEditPage', () => {
  it('opens Edit patient on the file’s patient over the section it came from', async () => {
    const { baseElement } = await openEdit('visits');
    const drawer = await screen.findByTestId('patient-drawer');
    expect(within(drawer).getByTestId('patient-drawer-title')).toHaveTextContent(
      'Edit patient',
    );
    expect(within(drawer).getByTestId('patient-drawer-tag')).toHaveTextContent('#3508');
    expect(within(drawer).getByTestId('patient-drawer-first-name')).toHaveValue('Priya');
    expect(screen.getByTestId('patient-section-visits')).toBeInTheDocument();
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('opens over Clinical notes when it came from no section', async () => {
    await openEdit('nowhere');
    await screen.findByTestId('patient-drawer');
    expect(await screen.findByTestId('patient-section-overview')).toBeInTheDocument();
  });

  it('shows only the section until the file has loaded', async () => {
    await openEdit('visits', { loaded: false });
    expect(await screen.findByTestId('patient-section-visits')).toBeInTheDocument();
    expect(screen.queryByTestId('patient-drawer')).not.toBeInTheDocument();
  });

  it('closes back to that section, in place', async () => {
    const user = userEvent.setup();
    const { router } = await openEdit('visits');
    await user.click(await screen.findByTestId('patient-drawer-close'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(TEST_PATIENT_ID, '/visits'),
      ),
    );
    expect(router.history).toHaveLength(1);
  });

  it('saves the change on the file’s record and goes back to the section', async () => {
    const user = userEvent.setup();
    const { router } = await openEdit('visits');
    const drawer = await screen.findByTestId('patient-drawer');
    await user.clear(within(drawer).getByTestId('patient-drawer-last-name'));
    await user.type(within(drawer).getByTestId('patient-drawer-last-name'), 'Patel');
    await user.click(within(drawer).getByTestId('patient-drawer-save'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(TEST_PATIENT_ID, '/visits'),
      ),
    );
    expect(updatePatient).toHaveBeenCalledWith({
      record: patientRecord(),
      fields: expect.objectContaining({ firstName: 'Priya', lastName: 'Patel' }),
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Priya Patel saved');
  });

  it('goes back to the Patients list once the patient is deleted', async () => {
    const user = userEvent.setup();
    const { router } = await openEdit('visits');
    const drawer = await screen.findByTestId('patient-drawer');
    await user.click(within(drawer).getByTestId('patient-drawer-delete'));
    const confirm = await screen.findByTestId('confirm-dialog');
    expect(within(confirm).getByText('Delete this record?')).toBeInTheDocument();
    await user.click(within(confirm).getByTestId('confirm-reason-duplicate'));
    await user.click(within(confirm).getByTestId('confirm-accept'));
    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));
    expect(deletePatient).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: TEST_PATIENT_ID, reason: 'duplicate' }),
    );
  });
});
