import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  renderPatientsRoutes,
  resetPatientsRoutes,
} from '../../__tests__/integration/patients-test-router.tsx';
import { usePatientsDialogRoute } from './usePatientsDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const PATIENTS = '/organization/acme/patients';

/** Shows what the hook reads, and closes through it. */
function Probe() {
  const { dialog, close } = usePatientsDialogRoute();
  return (
    <>
      <output>{JSON.stringify(dialog)}</output>
      <button type="button" onClick={close}>
        Close
      </button>
    </>
  );
}

const read = () => JSON.parse(screen.getByRole('status').textContent ?? '{}') as unknown;

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});
afterEach(() => resetPatientsRoutes());

describe('usePatientsDialogRoute (D24, S:31)', () => {
  it('opens nothing over the bare list', async () => {
    renderPatientsRoutes(PATIENTS, Probe);
    await waitFor(() => expect(read()).toEqual({ kind: 'none' }));
  });

  it('reads New patient and its prefill: the name and the mobile as E.164', async () => {
    renderPatientsRoutes(
      `${PATIENTS}/create?name=Priya%20Shah&phone=98765%2043210`,
      Probe,
    );
    await waitFor(() =>
      expect(read()).toEqual({
        kind: 'create',
        prefill: { name: 'Priya Shah', phone: '+919876543210' },
      }),
    );
  });

  it('closes onto the list with its own params, the prefill dropped', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(
      `${PATIENTS}/create?view=follow&q=shah&status=vip&name=Priya&phone=9876543210`,
      Probe,
    );
    await waitFor(() => expect(read()).toMatchObject({ kind: 'create' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(PATIENTS));
    expect(router.state.location.search).toEqual({
      view: 'follow',
      q: 'shah',
      status: 'vip',
    });
  });

  it('refuses a create link without Create: back to the list, with the permission toast once', async () => {
    const { router } = renderPatientsRoutes(`${PATIENTS}/create`, Probe, {
      role: 'marketing',
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(PATIENTS));
    expect(read()).toEqual({ kind: 'none' });
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
  });
});
