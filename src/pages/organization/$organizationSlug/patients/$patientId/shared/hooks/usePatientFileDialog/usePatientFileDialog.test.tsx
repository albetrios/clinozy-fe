import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientFile, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import {
  patientFileUrl,
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { usePatientFileDialog } from './usePatientFileDialog.ts';

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

/** Shows the section behind, and goes back to it. */
function Probe({ canOpen }: { canOpen?: boolean }) {
  const { behind, back } = usePatientFileDialog({ canOpen });
  return (
    <button type="button" onClick={back}>
      {behind}
    </button>
  );
}

/** The probe at `…/patients/<Priya>/<path>`. */
async function openAt(path: string, canOpen?: boolean) {
  const view = renderInPatientFile(<Probe canOpen={canOpen} />, { file: patientFile() });
  await act(() => view.router.navigate({ href: patientFileUrl(TEST_PATIENT_ID, path) }));
  return view;
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});
afterEach(() => resetPatientFile());

describe('usePatientFileDialog (S:34, 44–47; A-F1)', () => {
  it('keeps the section it opened from behind it, and goes back there in place', async () => {
    const user = userEvent.setup();
    const { router } = await openAt('/check-ins/create?from=prescriptions');
    const back = await screen.findByRole('button', { name: 'prescriptions' });
    const entries = router.history.length;
    await user.click(back);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(TEST_PATIENT_ID, '/prescriptions'),
      ),
    );
    expect(router.history).toHaveLength(entries);
  });

  it('shows Clinical notes when `from` names no section', async () => {
    await openAt('/reviews/create?from=nowhere');
    expect(await screen.findByRole('button', { name: 'overview' })).toBeInTheDocument();
  });

  it('turns a member who may not open it back, with the permission toast', async () => {
    const { router } = await openAt('/reviews/create?from=visits', false);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(TEST_PATIENT_ID, '/visits'),
      ),
    );
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
  });
});
