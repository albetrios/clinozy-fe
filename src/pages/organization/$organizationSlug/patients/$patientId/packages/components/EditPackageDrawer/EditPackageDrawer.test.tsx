import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as PackagesApiModule from '@/shared/api/clinic/patient-packages-api.ts';
import type { PatientPackageRow } from '@/shared/api/clinic/patient-packages-contracts.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

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
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
}));
vi.mock('@/shared/api/clinic/patient-packages-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PackagesApiModule>()),
  updatePatientPackage: vi.fn(),
}));

import { updatePatientPackage } from '@/shared/api/clinic/patient-packages-api.ts';

import { EditPackageDrawer } from './EditPackageDrawer.tsx';

/** Priya's LHR Full Face: 2 of 7 used, valid till 24 Sep 2027. */
const LHR: PatientPackageRow = {
  id: 'poff_lhr0000000000000000000',
  offeringId: 'off_lhr00000000000000000000',
  name: 'LHR Full Face · B4G7',
  sessionsTotal: 7,
  sessionsUsed: 2,
  sessionsLeft: 5,
  status: 'active',
  validUntil: '2027-09-24',
  invoiceId: 'invc_one0000000000000000000',
  createdAt: '2026-09-24T05:00:00.000Z',
  updatedAt: '2026-09-24T05:00:00.000Z',
};

function renderDrawer(row: PatientPackageRow = LHR) {
  const onClose = vi.fn();
  const onReload = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // The drawer reads the router (its exits); one route that is only the drawer.
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <TooltipProvider>
          <EditPackageDrawer
            patientId={TEST_PATIENT_ID}
            row={row}
            onReload={onReload}
            onClose={onClose}
          />
        </TooltipProvider>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, onClose, onReload };
}

const save = () => screen.getByTestId('package-drawer-save');
const sessions = () => screen.getByTestId('package-drawer-sessions');

beforeEach(() => {
  signInTestMember();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(updatePatientPackage).mockImplementation(async ({ change }) => ({
    ...LHR,
    ...change,
    updatedAt: '2026-10-10T00:00:00.000Z',
  }));
});
afterEach(() => {
  vi.resetAllMocks();
});

describe('EditPackageDrawer', () => {
  it('opens on the package as read: its name, its validity and sessions', async () => {
    renderDrawer();
    expect(await screen.findByTestId('package-drawer')).toHaveTextContent(
      'LHR Full Face · B4G7',
    );
    expect(sessions()).toHaveValue('7');
    expect(screen.getByTestId('package-drawer-valid-until')).toHaveTextContent('2027');
  });

  it('saves the changed sessions with the read’s `updated_at`, then toasts and closes', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();
    await user.click(await screen.findByTestId('package-drawer-sessions-increase'));
    await user.click(save());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(updatePatientPackage).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      packageId: LHR.id,
      change: { sessionsTotal: 8 },
      expectedUpdatedAt: LHR.updatedAt,
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledOnce();
  });

  it('never steps the sessions below what was used', async () => {
    const user = userEvent.setup();
    renderDrawer({ ...LHR, sessionsTotal: 2 });
    expect(await screen.findByTestId('package-drawer-sessions-decrease')).toBeDisabled();
    await user.click(save());
    // Nothing changed: it closes without a write.
    expect(updatePatientPackage).not.toHaveBeenCalled();
  });

  it('shows the server’s refusal on its field and keeps the drawer', async () => {
    const user = userEvent.setup();
    vi.mocked(updatePatientPackage).mockRejectedValueOnce(
      new HttpError('Bad request', 400, '/app/patients/x/offerings/y', 'PATCH', {
        error: {
          type: 'validation_error',
          errors: [
            {
              field: 'body.sessions_total',
              message: 'Too small: expected number to be >=1',
            },
          ],
        },
      }),
    );
    const { onClose } = renderDrawer();
    await user.click(await screen.findByTestId('package-drawer-sessions-increase'));
    await user.click(save());
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Too small: expected number to be >=1',
      ),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Too small: expected number to be >=1',
    );
    expect(sessions()).toHaveAttribute('aria-invalid', 'true');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('offers Reload when someone saved the package meanwhile', async () => {
    const user = userEvent.setup();
    vi.mocked(updatePatientPackage).mockRejectedValueOnce(
      new HttpError('Conflict', 409, '/app/patients/x/offerings/y', 'PATCH', {
        error: { reason: 'record_changed', detail: 'This record was changed meanwhile' },
      }),
    );
    const { onReload } = renderDrawer();
    await user.click(await screen.findByTestId('package-drawer-sessions-increase'));
    await user.click(save());
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Someone else saved this meanwhile. Reload to see their changes, then make yours again.',
        {
          id: 'package-save-failed',
          action: { label: 'Reload', onClick: expect.any(Function) },
        },
      ),
    );
    const [, options] = notifyMock.error.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    options.action.onClick();
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('has no axe violations', async () => {
    renderDrawer();
    expect(
      await axeForDialog(await screen.findByTestId('package-drawer')),
    ).toHaveNoViolations();
  });
});
