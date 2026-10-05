import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Treatment } from '@/shared/api/clinic/clinic-schema.ts';
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
  type TreatmentRowAccess,
  useTreatmentRowActions,
} from './useTreatmentRowActions.ts';

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

/** Each render's hook result, the latest last. */
const captured: ReturnType<typeof useTreatmentRowActions>[] = [];
const latest = () => captured.at(-1);
const onDelete = vi.fn();

function Probe(access: TreatmentRowAccess) {
  captured.push(useTreatmentRowActions({ ...access, onDelete }));
  return null;
}

let lhr: Treatment;

beforeEach(async () => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  onDelete.mockReset();
  captured.length = 0;
  resetClinicFixtures();
  lhr = await clinicFixtures.treatments.get(ref.treatment(498));
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

async function actionsFor(access: TreatmentRowAccess, treatment = lhr) {
  const view = renderInPatientFile(<Probe {...access} />, { section: 'treatments' });
  await waitFor(() => expect(latest()).toBeDefined());
  return { view, actions: latest()?.(treatment) ?? [] };
}

const select = (actions: { id: string; onSelect: () => void }[], id: string) =>
  actions.find((action) => action.id === id)?.onSelect();

describe('useTreatmentRowActions (H:4754)', () => {
  it('offers Check-in, Copy as next session, Edit and Delete to a writer who may delete', async () => {
    const { actions } = await actionsFor({
      writable: true,
      canDelete: true,
      canCheckIn: true,
    });
    expect(actions.map((action) => action.id)).toEqual([
      'check-in',
      'copy',
      'edit',
      'delete',
    ]);
    select(actions, 'delete');
    expect(onDelete).toHaveBeenCalledWith(lhr);
  });

  it('leaves nothing to a member who may neither write nor log', async () => {
    const { actions } = await actionsFor({
      writable: false,
      canDelete: false,
      canCheckIn: false,
    });
    expect(actions).toEqual([]);
  });

  it('opens the aftercare check-in and the edit drawer by URL', async () => {
    const { view, actions } = await actionsFor({
      writable: true,
      canDelete: false,
      canCheckIn: true,
    });
    select(actions, 'check-in');
    await waitFor(() =>
      expect(view.router.state.location.pathname).toMatch(/\/check-ins\/create$/),
    );
    expect(view.router.state.location.search).toEqual({
      from: 'treatments',
      treatment: lhr.id,
    });
    select(actions, 'edit');
    await waitFor(() =>
      expect(view.router.state.location.pathname).toMatch(
        new RegExp(`/treatments/${lhr.id}/edit$`),
      ),
    );
  });

  it('copies a treatment as the next session — no further than session 99', async () => {
    const { actions } = await actionsFor({
      writable: true,
      canDelete: false,
      canCheckIn: false,
    });
    select(actions, 'copy');
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Session 2 added'),
    );
    const last = await actionsFor(
      { writable: true, canDelete: false, canCheckIn: false },
      { ...lhr, sessionNo: 99, packageId: null },
    );
    select(last.actions, 'copy');
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Session 99 added'),
    );
  });
});
