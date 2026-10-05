import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Prescription } from '@/shared/api/clinic/clinic-schema.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import {
  type PrescriptionRowAccess,
  usePrescriptionRowActions,
} from './usePrescriptionRowActions.tsx';

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
const captured: ReturnType<typeof usePrescriptionRowActions>[] = [];
const latest = () => captured.at(-1);
const onDelete = vi.fn();

function Probe(access: PrescriptionRowAccess) {
  captured.push(usePrescriptionRowActions({ ...access, onDelete }));
  return null;
}

let rx: Prescription;

beforeEach(async () => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  printMock.mockClear();
  onDelete.mockReset();
  captured.length = 0;
  resetClinicFixtures();
  rx = await clinicFixtures.prescriptions.get(ref.prescription(497));
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

/** The row's actions once the probe has rendered. */
async function actionsFor(access: PrescriptionRowAccess) {
  const view = renderInPatientFile(<Probe {...access} />, { section: 'prescriptions' });
  await waitFor(() => expect(latest()).toBeDefined());
  return { view, actions: latest()?.(rx) ?? [] };
}

const select = (actions: { id: string; onSelect: () => void }[], id: string) =>
  actions.find((action) => action.id === id)?.onSelect();

describe('usePrescriptionRowActions (H:4753)', () => {
  it('offers every action, in order, to a writer who may delete and sell', async () => {
    const { actions } = await actionsFor({
      writable: true,
      canDelete: true,
      canSell: true,
    });
    expect(actions.map((action) => action.id)).toEqual([
      'print',
      'preview',
      'copy',
      'sell',
      'edit',
      'delete',
    ]);
    expect(actions.at(-1)?.destructive).toBe(true);
    select(actions, 'delete');
    expect(onDelete).toHaveBeenCalledWith(rx);
  });

  it('keeps the reader to Print and Preview', async () => {
    const { actions } = await actionsFor({
      writable: false,
      canDelete: false,
      canSell: false,
    });
    expect(actions.map((action) => action.id)).toEqual(['print', 'preview']);
  });

  it('prints the sheet, and opens the preview and the edit drawer by URL', async () => {
    const { view, actions } = await actionsFor({
      writable: true,
      canDelete: false,
      canSell: false,
    });
    select(actions, 'print');
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
    select(actions, 'preview');
    await waitFor(() =>
      expect(view.router.state.location.pathname).toMatch(
        new RegExp(`/prescriptions/${rx.id}$`),
      ),
    );
    select(actions, 'edit');
    await waitFor(() =>
      expect(view.router.state.location.pathname).toMatch(
        new RegExp(`/prescriptions/${rx.id}/edit$`),
      ),
    );
  });

  it('copies the prescription as today’s, toasting "Prescription copied"', async () => {
    const before = clinicFixtures.prescriptions.snapshot().length;
    const { actions } = await actionsFor({
      writable: true,
      canDelete: false,
      canSell: false,
    });
    select(actions, 'copy');
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Prescription copied'),
    );
    expect(clinicFixtures.prescriptions.snapshot()).toHaveLength(before + 1);
  });

  it('reports a sheet it cannot print', async () => {
    printMock.mockRejectedValueOnce(new Error('printer jammed'));
    const { actions } = await actionsFor({
      writable: false,
      canDelete: false,
      canSell: false,
    });
    select(actions, 'print');
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
  });
});
