import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { listPatientInvoices } from '@/shared/api/clinic/payments-api.ts';
import type { PatientInvoiceRow } from '@/shared/api/clinic/payments-contracts.ts';

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

/** Each render's hook result, the latest last. */
const captured: InvoiceRowActions[] = [];
const latest = () => captured.at(-1);
const onDelete = vi.fn();

function Probe() {
  captured.push(useInvoiceRowActions({ onDelete }));
  return null;
}

let invoices: PatientInvoiceRow[] = [];
const invoice = (seq: number) => {
  const found = invoices.find((candidate) => candidate.seq === seq);
  if (!found) throw new Error(`no invoice #${seq}`);
  return found;
};

beforeEach(async () => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  printMock.mockClear();
  onDelete.mockReset();
  captured.length = 0;
  resetClinicFixtures();
  invoices = await listPatientInvoices(patientRef('Dharti Galani'));
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

/** The hook once the member's access has resolved. */
async function rowFor(role: Role) {
  const view = renderInPatientFile(<Probe />, { section: 'invoices', role });
  await waitFor(() => expect(latest()?.actions(invoice(787)).length).toBeGreaterThan(2));
  return { view, hook: latest() as InvoiceRowActions };
}

const ids = (hook: InvoiceRowActions, seq: number) =>
  hook.actions(invoice(seq)).map((action) => action.id);

describe('useInvoiceRowActions (H:4748)', () => {
  it('gives the owner every action on an invoice that owes, and no Delete on a sale’s', async () => {
    const { hook } = await rowFor('owner');
    expect(ids(hook, 787)).toEqual(['print', 'preview', 'pay', 'edit', 'delete']);
    expect(ids(hook, 788)).toEqual(['print', 'preview', 'pay', 'edit']);
    expect(ids(hook, 786)).toEqual(['print', 'preview', 'edit', 'delete']);
    hook
      .actions(invoice(787))
      .find((action) => action.id === 'delete')
      ?.onSelect();
    expect(onDelete).toHaveBeenCalledWith(invoice(787));
  });

  it('keeps Delete from a member without the void ability', async () => {
    const { hook } = await rowFor('front_desk');
    expect(ids(hook, 787)).toEqual(['print', 'preview', 'pay', 'edit']);
  });

  it('prints the invoice’s sheet, read on demand', async () => {
    const { hook } = await rowFor('owner');
    hook
      .actions(invoice(787))
      .find((action) => action.id === 'print')
      ?.onSelect();
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
  });

  it('reports an invoice it cannot read to print', async () => {
    const { hook } = await rowFor('owner');
    hook
      .actions({ ...invoice(787), id: '00000000-0000-4000-8000-00000000dead' })
      .find((action) => action.id === 'print')
      ?.onSelect();
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    expect(printMock).not.toHaveBeenCalled();
  });

  it('opens Edit invoice from a row, keeping the section behind it', async () => {
    const { view, hook } = await rowFor('owner');
    hook.open(invoice(787));
    await waitFor(() =>
      expect(view.router.state.location.pathname).toBe(
        `/organization/acme/invoices/${invoice(787).id}/edit`,
      ),
    );
    expect(view.router.state.location.search).toEqual({
      from: 'patients/patient/invoices',
    });
  });
});
