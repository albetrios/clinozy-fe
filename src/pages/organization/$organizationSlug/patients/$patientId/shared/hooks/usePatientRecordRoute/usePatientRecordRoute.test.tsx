import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/shared/errors/HttpError.ts';
import { patientFile, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import {
  patientFileUrl,
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { usePatientRecordRoute } from './usePatientRecordRoute.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** The report on file, by its public id. */
const REPORT = 'rep_cbc000000000000000000';
/** A report id the API answers 404 for — gone, or never there. */
const GONE = 'rep_gone00000000000000000';

const RECORDS: Record<string, { name: string }> = { [REPORT]: { name: 'CBC report' } };

async function fetchRecord(id: string) {
  const record = RECORDS[id];
  if (!record) {
    throw new HttpError(
      'Not Found',
      404,
      `/app/patients/${TEST_PATIENT_ID}/reports/${id}`,
      'GET',
      {
        error: { type: 'request_error', code: 'not_found', detail: 'Report not found' },
      },
    );
  }
  return record;
}

/** Reads the hook as a Reports section would. */
function Probe({ id, canCreate }: { id?: string; canCreate: boolean | undefined }) {
  const route = usePatientRecordRoute({
    section: 'reports',
    id,
    queryKey: (key) => ['probe', key],
    fetchRecord,
    recordLabel: 'Report',
    canCreate,
  });
  return (
    <div>
      <p data-testid="mode">{route.mode}</p>
      <p data-testid="record">{route.record?.name ?? ''}</p>
      <button type="button" onClick={route.close}>
        Close
      </button>
    </div>
  );
}

const reports = (rest = '') => patientFileUrl(TEST_PATIENT_ID, `/reports${rest}`);

function renderAt(rest: string, props: { id?: string; canCreate: boolean | undefined }) {
  const view = renderInPatientFile(<Probe {...props} />, {
    file: patientFile(),
    section: 'reports',
  });
  act(() => view.router.history.push(reports(rest)));
  return view;
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});
afterEach(() => resetPatientFile());

describe('usePatientRecordRoute', () => {
  it('opens nothing on the section itself', async () => {
    renderAt('', { canCreate: true });
    expect(await screen.findByTestId('mode')).toHaveTextContent('none');
  });

  it('opens create on `create` for a member who may create', async () => {
    const { router } = renderAt('/create', { canCreate: true });
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('create'));
    expect(router.state.location.pathname).toBe(reports('/create'));
  });

  it('waits for the access before it refuses', async () => {
    renderAt('/create', { canCreate: undefined });
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('create'));
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('turns a member without create back with the permission toast', async () => {
    const { router } = renderAt('/create', { canCreate: false });
    await waitFor(() => expect(router.state.location.pathname).toBe(reports()));
    expect(screen.getByTestId('mode')).toHaveTextContent('none');
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
  });

  it('opens a record as a view', async () => {
    renderAt(`/${REPORT}`, { id: REPORT, canCreate: false });
    await waitFor(() =>
      expect(screen.getByTestId('record')).toHaveTextContent('CBC report'),
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('view');
  });

  it('opens a record as an edit under `/edit`', async () => {
    renderAt(`/${REPORT}/edit`, { id: REPORT, canCreate: false });
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('edit'));
    await waitFor(() =>
      expect(screen.getByTestId('record')).toHaveTextContent('CBC report'),
    );
  });

  it('closes back to the section, keeping no dialog in the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderAt(`/${REPORT}`, { id: REPORT, canCreate: true });
    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('view'));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(reports()));
  });

  it('goes back with "Report not found" for an id that names nothing', async () => {
    const { router } = renderAt(`/${GONE}`, { id: GONE, canCreate: true });
    await waitFor(() => expect(router.state.location.pathname).toBe(reports()));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Report not found · it may have been deleted',
    );
  });
});
