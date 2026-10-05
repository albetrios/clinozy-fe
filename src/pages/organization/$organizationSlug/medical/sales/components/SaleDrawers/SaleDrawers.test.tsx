import { Outlet } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { CrossRoomDialogContext } from '@/shared/hooks/useCrossRoomDialog/index.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { SaleDrawers } from './SaleDrawers.tsx';

// Each drawer stands in as its name and the props it was given: this unit picks one.
const { stub } = vi.hoisted(() => ({
  stub:
    (name: string) =>
    ({ onClose, ...props }: { onClose: () => void } & Record<string, unknown>) => {
      // A sale record is written as its seq.
      const { sale } = props;
      const shown =
        typeof sale === 'object' && sale !== null && 'seq' in sale
          ? { ...props, sale: sale.seq }
          : props;
      return (
        <section aria-label={name}>
          <output data-testid={name}>{JSON.stringify(shown)}</output>
          <button type="button" onClick={onClose}>
            Close {name}
          </button>
        </section>
      );
    },
}));
vi.mock('@/shared/components/InvoiceDrawer/index.ts', () => ({
  InvoiceDrawer: stub('new-sale'),
}));
vi.mock('../SaleDrawer/index.ts', () => ({ SaleDrawer: stub('sale') }));
vi.mock('../SaleReturnDrawer/index.ts', () => ({
  SaleReturnDrawer: stub('sale-return'),
}));

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');
const ROOM = '/organization/acme/medical/sales';
const RHEA = patientRef('Rhea Shah');
const RX = '4c5d6e7f-8a9b-4c0d-9e1f-2a3b4c5d6e7f';
const props = (name: string) =>
  JSON.parse(screen.getByTestId(name).textContent ?? '{}') as unknown;

/** The Sales tab: the drawers over an outlet that holds the dialog routes. */
function SalesTab() {
  return (
    <>
      <SaleDrawers />
      <Outlet />
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetMedicalRoutes();
  resetClinicFixtures();
});

describe('SaleDrawers', () => {
  it('opens New sale — the Invoice drawer, Medical locked — and closes to the room it came from', async () => {
    const { container, router } = renderMedicalRoutes(
      `${ROOM}/create?prescription=${RX}&customer=${RHEA}&from=today`,
      { sales: SalesTab },
    );
    await waitFor(() =>
      expect(props('new-sale')).toEqual({
        mode: 'create',
        sale: true,
        open: true,
        prefill: { prescriptionId: RX, patientId: RHEA },
      }),
    );
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Close new-sale' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/today'),
    );
  });

  it('opens the Sale and Return from patient from their routes', async () => {
    const sale = ref.medicalSale(983);
    const view = renderMedicalRoutes(`${ROOM}/${sale}`, { sales: SalesTab });
    await waitFor(() => expect(props('sale')).toMatchObject({ open: true, sale: 983 }));
    view.unmount();
    renderMedicalRoutes(`${ROOM}/${sale}/return`, { sales: SalesTab });
    await waitFor(() =>
      expect(props('sale-return')).toMatchObject({ open: true, sale: 983 }),
    );
  });

  it('over another room (A-P1), New sale reads its own route and closes back to that room', async () => {
    const close = vi.fn();
    const { router } = renderMedicalRoutes(ROOM, {
      sales: () => (
        <CrossRoomDialogContext.Provider
          value={{
            pathname: `${ROOM}/create`,
            search: { prescription: RX, from: 'today' },
            params: { organizationSlug: 'acme' },
            close,
          }}
        >
          <SaleDrawers />
        </CrossRoomDialogContext.Provider>
      ),
    });
    await waitFor(() =>
      expect(props('new-sale')).toMatchObject({ prefill: { prescriptionId: RX } }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close new-sale' }));
    expect(close).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe(ROOM);
  });
});
