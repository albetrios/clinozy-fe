import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appToday } from '@/shared/api/app/app-time.ts';
import type { PrescriptionRecord } from '@/shared/api/app/prescriptions-contracts.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  prescriptionRecord,
  resetRxWorld,
  rxServerApi,
  TEST_PRESCRIPTION_ID,
} from '../../__tests__/integration/prescription-doubles.ts';
import {
  prescriptionsUrl,
  renderPrescriptions,
  resetPrescriptionsMember,
} from '../../__tests__/integration/prescriptions-test-router.tsx';
import type { PrescriptionDrawerAccess } from '../../components/PrescriptionDrawer/index.ts';
import { usePrescriptionRowActions } from './usePrescriptionRowActions.tsx';

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
vi.mock('@/shared/api/app/prescriptions-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../__tests__/integration/prescription-doubles.ts')).rxServerApi,
}));
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => {
  const { DOCTOR_NISHA } = await import('@/tests/utils/appointment-doubles.ts');
  return {
    ...(await importOriginal<object>()),
    fetchTeamDirectory: vi.fn(async () => [DOCTOR_NISHA]),
  };
});
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(async () => 'mem_nisha0000000000000000'),
}));

/** Each render's hook result, the latest last. */
const captured: ReturnType<typeof usePrescriptionRowActions>[] = [];
const latest = () => captured.at(-1);
const onDelete = vi.fn();

function Probe(access: PrescriptionDrawerAccess) {
  captured.push(usePrescriptionRowActions({ ...access, onDelete }));
  return null;
}

const DRAFT = prescriptionRecord();
const APPROVED = prescriptionRecord({ status: 'approved' });
const EVERYTHING: PrescriptionDrawerAccess = {
  writes: true,
  approves: true,
  deletes: true,
  sells: true,
};

/** The probe rendered in the section, and a row's actions once it has. */
async function actionsFor(access: PrescriptionDrawerAccess, rx: PrescriptionRecord) {
  const view = renderPrescriptions(prescriptionsUrl(''), { ui: <Probe {...access} /> });
  await waitFor(() => expect(latest()).toBeDefined());
  return { view, actions: latest()?.(rx) ?? [] };
}

const ids = (actions: { id: string }[]) => actions.map((action) => action.id);
const select = (actions: { id: string; onSelect: () => void }[], id: string) =>
  actions.find((action) => action.id === id)?.onSelect();

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  printMock.mockClear();
  onDelete.mockReset();
  for (const fn of Object.values(rxServerApi)) fn.mockClear();
  captured.length = 0;
  resetRxWorld({ prescriptions: [DRAFT] });
});
afterEach(() => resetPrescriptionsMember());

describe('usePrescriptionRowActions (H:4753; Q19)', () => {
  it('offers a draft’s actions — Edit and Delete, no sale — to a member who may do all', async () => {
    const { actions } = await actionsFor(EVERYTHING, DRAFT);
    expect(ids(actions)).toEqual(['print', 'preview', 'copy', 'edit', 'delete']);
  });

  it('offers an approved one’s — the sale, no Edit, no Delete: it is final', async () => {
    const { actions } = await actionsFor(EVERYTHING, APPROVED);
    expect(ids(actions)).toEqual(['print', 'preview', 'copy', 'sell']);
  });

  it('gives a reader Print and Preview only', async () => {
    const { actions } = await actionsFor(
      { writes: false, approves: false, deletes: false, sells: false },
      DRAFT,
    );
    expect(ids(actions)).toEqual(['print', 'preview']);
  });

  it('prints the sheet with the clinic, previews and edits by the URL', async () => {
    const { actions, view } = await actionsFor(EVERYTHING, DRAFT);
    select(actions, 'print');
    await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
    expect(rxServerApi.fetchRxSheetClinic).toHaveBeenCalled();

    select(actions, 'preview');
    await waitFor(() =>
      expect(view.router.state.location.pathname).toBe(
        prescriptionsUrl(`/${TEST_PRESCRIPTION_ID}`),
      ),
    );
    select(actions, 'edit');
    await waitFor(() =>
      expect(view.router.state.location.pathname).toBe(
        prescriptionsUrl(`/${TEST_PRESCRIPTION_ID}/edit`),
      ),
    );
  });

  it('copies it as today’s draft and opens the sale of an approved one', async () => {
    const { actions } = await actionsFor(EVERYTHING, APPROVED);
    select(actions, 'copy');
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Prescription copied'),
    );
    expect(rxServerApi.createPrescription.mock.lastCall?.[0]).toMatchObject({
      patientId: APPROVED.patientId,
      fields: {
        doctorId: APPROVED.doctorId,
        date: appToday(),
        items: APPROVED.items,
        advice: APPROVED.advice,
      },
    });
    expect(rxServerApi.approvePrescription).not.toHaveBeenCalled();

    const { actions: again, view } = await actionsFor(EVERYTHING, APPROVED);
    select(again, 'sell');
    await waitFor(() =>
      expect(shownLocation(view.router).pathname).toBe(
        '/organization/acme/medical/sales/create',
      ),
    );
    expect(shownLocation(view.router).search).toMatchObject({
      prescription: APPROVED.id,
    });
  });

  it('asks before deleting', async () => {
    const { actions } = await actionsFor(EVERYTHING, DRAFT);
    select(actions, 'delete');
    expect(onDelete).toHaveBeenCalledWith(DRAFT);
  });
});
