import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type * as InvoicesApiModule from '@/shared/api/app/invoices-api.ts';
import { fetchInvoice } from '@/shared/api/app/invoices-api.ts';
import type { InvoiceRecord } from '@/shared/api/app/invoices-contracts.ts';
import { CROSS_ROOM_PARAM } from '@/shared/app/app-referrer.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { invoiceDetail } from '@/tests/utils/invoice-doubles.ts';
import { patientFile, patientRecord } from '@/tests/utils/patient-doubles.ts';
import { invoiceRecord, TEST_MONEY_PATIENT_ID } from '@/tests/utils/payments-doubles.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { type InvoiceRowActions, useInvoiceRowActions } from './useInvoiceRowActions.ts';

const { notifyMock, printMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  printMock: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/components/PrintTemplate/print-document.ts', () => ({
  printDocument: printMock,
  PRINTING_ATTRIBUTE: 'data-printing',
}));
vi.mock('@/shared/api/app/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof InvoicesApiModule>()),
  fetchInvoice: vi.fn(),
}));

/** Each render's hook result, the latest last. */
const captured: InvoiceRowActions[] = [];
const latest = () => captured.at(-1);
const onDelete = vi.fn();
/** Whether the member's money access had resolved, render by render. */
const resolved: boolean[] = [];

function Probe() {
  resolved.push(usePaymentAccess().resolved);
  captured.push(useInvoiceRowActions({ onDelete }));
  return null;
}

/** #5 — a consultation that still owes ₹100. */
const OWES = invoiceRecord();
/** A clinic invoice paid in full. */
const PAID = invoiceRecord({
  id: 'invc_paidinfull00000000000',
  seq: 6,
  type: 'clinic',
  paid: 500,
  due: 0,
  status: 'paid',
});
/** A Medical sale's invoice — Medical voids it. */
const SALE = invoiceRecord({ id: 'invc_medicalsale000000000', seq: 7, type: 'medical' });
/** A payment on a closed day settled it — read only. */
const SETTLED = invoiceRecord({
  id: 'invc_settled0000000000000',
  seq: 8,
  isSettled: true,
});

/** Every money code the Owner holds. */
const EVERY_CODE: OrganizationPermission[] = [
  'payment:read',
  'payment:create',
  'payment:update',
  'payment:delete',
];

const FILE = patientFile({ patient: patientRecord({ id: TEST_MONEY_PATIENT_ID }) });
const FROM = `patients/${TEST_MONEY_PATIENT_ID}/invoices`;

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  printMock.mockClear();
  onDelete.mockReset();
  vi.mocked(fetchInvoice).mockReset();
  captured.length = 0;
  resolved.length = 0;
});
afterEach(() => resetPatientFile());

/** The hook for a signed-in member holding `codes` (their own, not a View-as preview). */
async function rowFor(codes: readonly OrganizationPermission[]) {
  const view = renderInPatientFile(<Probe />, { section: 'invoices', file: FILE });
  act(() => {
    useUIStore.setState({ previewRole: null });
    useOrganizationStore.getState().setPermissions(['organization:read', ...codes]);
  });
  await waitFor(() => expect(resolved.at(-1)).toBe(true));
  return { view, hook: latest() as InvoiceRowActions };
}

const ids = (hook: InvoiceRowActions, invoice: InvoiceRecord) =>
  hook.actions(invoice).map((action) => action.id);

describe('useInvoiceRowActions (H:4748)', () => {
  it('gives every action to a member holding every money code on an invoice that owes', async () => {
    const { hook } = await rowFor(EVERY_CODE);
    expect(ids(hook, OWES)).toEqual([
      'print',
      'preview',
      'copy',
      'pay',
      'edit',
      'delete',
    ]);
    expect(ids(hook, PAID)).toEqual(['print', 'preview', 'copy', 'edit', 'delete']);
    hook
      .actions(OWES)
      .find((action) => action.id === 'delete')
      ?.onSelect();
    expect(onDelete).toHaveBeenCalledWith(OWES);
  });

  it('never changes a sale’s invoice or a settled one from the file', async () => {
    const { hook } = await rowFor(EVERY_CODE);
    expect(ids(hook, SALE)).toEqual(['print', 'preview', 'pay']);
    expect(ids(hook, SETTLED)).toEqual(['print', 'preview', 'copy', 'pay']);
  });

  it('keeps each action to its code: Delete to payment:delete, Edit to payment:update', async () => {
    const { hook } = await rowFor(['payment:read', 'payment:create', 'payment:update']);
    expect(ids(hook, OWES)).toEqual(['print', 'preview', 'copy', 'pay', 'edit']);
  });

  it('offers a reader only Print and Preview, and opens the preview from a row', async () => {
    const { view, hook } = await rowFor(['payment:read']);
    expect(ids(hook, OWES)).toEqual(['print', 'preview']);
    hook.open(OWES);
    await waitFor(() =>
      expect(view.router.history.location.pathname).toBe(
        `/organization/acme/invoices/${OWES.id}`,
      ),
    );
  });

  it('copies an invoice into a new one for this patient, over the file’s Invoices (A-P1)', async () => {
    const { view, hook } = await rowFor(EVERY_CODE);
    hook
      .actions(OWES)
      .find((action) => action.id === 'copy')
      ?.onSelect();
    const section = `/organization/acme/patients/${TEST_MONEY_PATIENT_ID}/invoices`;
    const copy = `/organization/acme/invoices/create?type=consultation&patient=${TEST_MONEY_PATIENT_ID}&copyOf=${OWES.id}&from=${encodeURIComponent(FROM)}`;
    await waitFor(() => expect(view.router.history.location.href).toBe(copy));
    expect(view.router.state.location.pathname).toBe(section);
    expect(view.router.state.location.search).toEqual({
      [CROSS_ROOM_PARAM]: copy.replace('/organization/acme/', ''),
    });
  });

  it('records a payment for the invoice by its public id, keeping the section behind it', async () => {
    const { view, hook } = await rowFor(EVERY_CODE);
    hook
      .actions(OWES)
      .find((action) => action.id === 'pay')
      ?.onSelect();
    await waitFor(() =>
      expect(view.router.history.location.pathname).toBe(
        '/organization/acme/payments/receive',
      ),
    );
    expect(view.router.history.location.search).toBe(
      `?patient=${TEST_MONEY_PATIENT_ID}&invoice=${OWES.id}&from=${encodeURIComponent(FROM)}`,
    );
  });

  it('opens Edit invoice from a row for a member who may change it', async () => {
    const { view, hook } = await rowFor(EVERY_CODE);
    hook.open(OWES);
    await waitFor(() =>
      expect(view.router.history.location.pathname).toBe(
        `/organization/acme/invoices/${OWES.id}/edit`,
      ),
    );
    hook.open(SETTLED);
    await waitFor(() =>
      expect(view.router.history.location.pathname).toBe(
        `/organization/acme/invoices/${SETTLED.id}`,
      ),
    );
  });

  it('prints the invoice’s sheet, read on demand', async () => {
    vi.mocked(fetchInvoice).mockResolvedValue(invoiceDetail(OWES));
    const { hook } = await rowFor(EVERY_CODE);
    hook
      .actions(OWES)
      .find((action) => action.id === 'print')
      ?.onSelect();
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
    expect(fetchInvoice).toHaveBeenCalledWith(OWES.id);
  });

  it('reports an invoice it cannot read to print', async () => {
    vi.mocked(fetchInvoice).mockRejectedValue(
      new HttpError('Not Found', 404, '/app/invoices/{invoice_id}', 'GET'),
    );
    const { hook } = await rowFor(EVERY_CODE);
    hook
      .actions(OWES)
      .find((action) => action.id === 'print')
      ?.onSelect();
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    expect(printMock).not.toHaveBeenCalled();
  });
});
