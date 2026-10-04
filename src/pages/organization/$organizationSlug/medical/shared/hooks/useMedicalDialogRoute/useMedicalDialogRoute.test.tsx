import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { fetchSupplier, medicalQueryKeys } from '../../medical-api.ts';
import { useMedicalDialogRoute } from './useMedicalDialogRoute.ts';

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
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));

const ROOM = '/organization/acme/medical';

/** The dialog the URL names, written out. */
function Probe() {
  const { dialog } = useMedicalDialogRoute({
    tab: 'suppliers',
    param: 'supplierId',
    queryKey: medicalQueryKeys.supplier,
    fetchRecord: fetchSupplier,
    recordLabel: 'Supplier',
  });
  let text = dialog.kind;
  if (dialog.kind === 'create') text += ` ${dialog.prefill.name ?? ''}`;
  if (dialog.kind === 'record') {
    text += ` ${dialog.action || 'view'} ${dialog.record?.name ?? '…'}`;
  }
  return <p data-testid="dialog">{text}</p>;
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetClinicFixtures();
});

describe('useMedicalDialogRoute (KICKOFF §4, S:115)', () => {
  it('reads nothing on the list, a create with its prefill, and a record route', async () => {
    const list = renderMedicalRoutes(`${ROOM}/suppliers`, { suppliers: Probe });
    expect(await screen.findByTestId('dialog')).toHaveTextContent('none');
    list.unmount();

    const create = renderMedicalRoutes(`${ROOM}/suppliers/create?name=Om%20Pharma`, {
      suppliers: Probe,
    });
    expect(await screen.findByTestId('dialog')).toHaveTextContent('create Om Pharma');
    create.unmount();

    renderMedicalRoutes(`${ROOM}/suppliers/${ref.supplier(52)}/edit`, {
      suppliers: Probe,
    });
    await waitFor(() =>
      expect(screen.getByTestId('dialog')).toHaveTextContent(
        'record edit Akshar Medicines',
      ),
    );
  });

  it('goes back to the list with "Supplier not found" for an unknown id', async () => {
    const unknown = '0b9c7a3e-2f6d-4f8a-9c1e-5d4b3a2f1e0d';
    const { router } = renderMedicalRoutes(`${ROOM}/suppliers/${unknown}/edit?q=ak`, {
      suppliers: Probe,
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/suppliers`));
    expect(router.state.location.search).toMatchObject({ q: 'ak' });
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Supplier not found · it may have been deleted',
    );
  });

  it('sends a member without Create back from a create link', async () => {
    const { router } = renderMedicalRoutes(
      `${ROOM}/suppliers/create`,
      { suppliers: Probe },
      {
        role: 'accountant',
      },
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/suppliers`));
    expect(notifyMock.info).toHaveBeenCalled();
  });
});
