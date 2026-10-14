import { Outlet } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('../../../shared/medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchMedicalSale: vi.fn(),
}));
vi.mock('../../../shared/medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createSale: vi.fn(),
}));

import type { SaleDraft } from '@/shared/components/InvoiceDrawer/index.ts';
import { CrossRoomDialogContext } from '@/shared/hooks/useCrossRoomDialog/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  saleRow,
  TEST_BUYER_CONTACT_ID,
  TEST_BUYER_PATIENT_ID,
  TEST_MEDICAL_BRANCH_ID,
  TEST_MEDICINE_ID,
  TEST_PRESCRIPTION_ID,
  TEST_SALE_ID,
  TEST_SALE_INVOICE_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { fetchMedicalSale } from '../../../shared/medical-api.ts';
import { createSale } from '../../../shared/medical-records-api.ts';
import { SaleDrawers } from './SaleDrawers.tsx';

/** A sale as the drawer hands the room's write. */
const DRAFT: SaleDraft = {
  branchId: TEST_MEDICAL_BRANCH_ID,
  contactId: TEST_BUYER_CONTACT_ID,
  items: [{ medicineId: TEST_MEDICINE_ID, qty: 2, discountPct: 0 }],
  overallDiscount: 0,
  memberIds: [],
  prescriptionId: TEST_PRESCRIPTION_ID,
  remark: null,
  payment: null,
};

// Each drawer stands in as its name and the props it was given: this unit picks one.
const { stub, written } = vi.hoisted(() => ({
  written: { current: null as unknown },
  stub:
    (name: string) =>
    ({ onClose, ...props }: { onClose: () => void } & Record<string, unknown>) => {
      // A sale record is written as its seq; New sale's write is tried with the draft.
      const { sale } = props;
      const shown =
        typeof sale === 'object' && sale !== null && 'seq' in sale
          ? { ...props, sale: sale.seq }
          : props;
      const write =
        typeof sale === 'object' && sale !== null && 'create' in sale
          ? (sale.create as (draft: unknown) => Promise<unknown>)
          : null;
      return (
        <section aria-label={name}>
          <output data-testid={name}>{JSON.stringify(shown)}</output>
          <button type="button" onClick={onClose}>
            Close {name}
          </button>
          {write ? (
            <button
              type="button"
              onClick={() =>
                void write(written.current).then((outcome) => {
                  written.current = outcome;
                })
              }
            >
              Save {name}
            </button>
          ) : null}
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

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');
const ROOM = '/organization/acme/medical/sales';
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
  signInTestMember();
  written.current = DRAFT;
  vi.mocked(fetchMedicalSale).mockResolvedValue(saleRow({ seq: 983 }));
  vi.mocked(createSale).mockResolvedValue(saleRow());
});
afterEach(() => {
  vi.useRealTimers();
  resetMedicalRoutes();
  vi.mocked(fetchMedicalSale).mockReset();
  vi.mocked(createSale).mockReset();
});

describe('SaleDrawers', () => {
  it('opens New sale — the Invoice drawer, Medical locked — on the buyer’s contact, and closes to the room it came from', async () => {
    const { container, router } = renderMedicalRoutes(
      `${ROOM}/create?prescription=${TEST_PRESCRIPTION_ID}&customer=${TEST_BUYER_CONTACT_ID}&from=today`,
      { sales: SalesTab },
    );
    await waitFor(() =>
      expect(props('new-sale')).toEqual({
        mode: 'create',
        sale: {},
        open: true,
        prefill: {
          prescriptionId: TEST_PRESCRIPTION_ID,
          contactId: TEST_BUYER_CONTACT_ID,
        },
      }),
    );
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Close new-sale' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/today'),
    );
  });

  it('starts on a patient’s file when `customer` names one', async () => {
    renderMedicalRoutes(`${ROOM}/create?customer=${TEST_BUYER_PATIENT_ID}`, {
      sales: SalesTab,
    });
    await waitFor(() =>
      expect(props('new-sale')).toMatchObject({
        prefill: { prescriptionId: null, patientId: TEST_BUYER_PATIENT_ID },
      }),
    );
  });

  it('hands New sale the room’s write: `POST /app/medical-sales`, answered with its invoice and number', async () => {
    renderMedicalRoutes(`${ROOM}/create`, { sales: SalesTab });
    await userEvent.click(await screen.findByRole('button', { name: 'Save new-sale' }));
    await waitFor(() =>
      expect(createSale).toHaveBeenCalledWith({
        input: DRAFT,
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(written.current).toEqual({ invoiceId: TEST_SALE_INVOICE_ID, seq: 978 }),
    );
  });

  it('opens the Sale and Return from patient from their routes', async () => {
    const view = renderMedicalRoutes(`${ROOM}/${TEST_SALE_ID}`, { sales: SalesTab });
    await waitFor(() => expect(props('sale')).toMatchObject({ open: true, sale: 983 }));
    expect(fetchMedicalSale).toHaveBeenCalledWith(TEST_SALE_ID);
    view.unmount();
    renderMedicalRoutes(`${ROOM}/${TEST_SALE_ID}/return`, { sales: SalesTab });
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
            search: { prescription: TEST_PRESCRIPTION_ID, from: 'today' },
            params: { organizationSlug: 'acme' },
            close,
          }}
        >
          <SaleDrawers />
        </CrossRoomDialogContext.Provider>
      ),
    });
    await waitFor(() =>
      expect(props('new-sale')).toMatchObject({
        prefill: { prescriptionId: TEST_PRESCRIPTION_ID },
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close new-sale' }));
    expect(close).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe(ROOM);
  });
});
