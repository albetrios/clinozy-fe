import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as TreatmentsApiModule from '@/shared/api/clinic/treatments-api.ts';
import { createTreatment } from '@/shared/api/clinic/treatments-api.ts';
import type { TreatmentRecord } from '@/shared/api/clinic/treatments-contracts.ts';
import { patientFile } from '@/tests/utils/patient-doubles.ts';

import {
  seededTreatmentsWorld,
  TEST_PACKAGE_ID,
  treatmentRecord,
  type TreatmentsWorld,
} from '../../__tests__/integration/treatment-doubles.ts';
import {
  renderInTreatments,
  resetTreatments,
} from '../../__tests__/integration/treatments-test-router.tsx';
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

const world = vi.hoisted(() => ({}) as TreatmentsWorld);
vi.mock('@/shared/api/clinic/treatments-api.ts', async (importOriginal) => {
  const { treatmentsApiDouble } =
    await import('../../__tests__/integration/treatment-doubles.ts');
  return {
    ...(await importOriginal<typeof TreatmentsApiModule>()),
    ...treatmentsApiDouble(world),
  };
});

/** Each render's hook result, the latest last. */
const captured: ReturnType<typeof useTreatmentRowActions>[] = [];
const latest = () => captured.at(-1);
const onReverse = vi.fn();

function Probe({
  spendable = new Set<string>(),
  ...access
}: TreatmentRowAccess & { spendable?: ReadonlySet<string> }) {
  captured.push(
    useTreatmentRowActions({ ...access, spendablePackageIds: spendable, onReverse }),
  );
  return null;
}

const LHR = treatmentRecord();
const FILE = patientFile();
const EVERYTHING: TreatmentRowAccess = {
  canCreate: true,
  canUpdate: true,
  canCheckIn: true,
};

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  onReverse.mockReset();
  captured.length = 0;
  Object.assign(world, seededTreatmentsWorld());
});
afterEach(() => resetTreatments());

async function actionsFor(
  access: TreatmentRowAccess,
  treatment: TreatmentRecord = LHR,
  spendable?: ReadonlySet<string>,
) {
  const view = renderInTreatments(<Probe {...access} spendable={spendable} />, {
    file: FILE,
  });
  await waitFor(() => expect(latest()).toBeDefined());
  return { view, actions: latest()?.(treatment) ?? [] };
}

const select = (actions: { id: string; onSelect: () => void }[], id: string) =>
  actions.find((action) => action.id === id)?.onSelect();

describe('useTreatmentRowActions (H:4754)', () => {
  it('offers Check-in, Copy as next session, Edit and Reverse to a member with every gate', async () => {
    const { actions } = await actionsFor(EVERYTHING);
    expect(actions.map((action) => action.id)).toEqual([
      'check-in',
      'copy',
      'edit',
      'reverse',
    ]);
    expect(actions.find((action) => action.id === 'reverse')?.destructive).toBe(true);
    select(actions, 'reverse');
    expect(onReverse).toHaveBeenCalledWith(LHR);
  });

  it('leaves nothing to a member who may neither write nor log, nor on a reversed session', async () => {
    const none = await actionsFor({
      canCreate: false,
      canUpdate: false,
      canCheckIn: false,
    });
    expect(none.actions).toEqual([]);
    const reversed = await actionsFor(EVERYTHING, { ...LHR, status: 'reversed' });
    expect(reversed.actions).toEqual([]);
  });

  it('opens the aftercare check-in and the edit drawer by URL', async () => {
    const { view, actions } = await actionsFor(EVERYTHING);
    select(actions, 'check-in');
    await waitFor(() =>
      expect(view.router.state.location.pathname).toMatch(/\/check-ins\/create$/),
    );
    expect(view.router.state.location.search).toEqual({
      from: 'treatments',
      treatment: LHR.id,
    });
    select(actions, 'edit');
    await waitFor(() =>
      expect(view.router.state.location.pathname).toMatch(
        new RegExp(`/treatments/${LHR.id}/edit$`),
      ),
    );
  });

  it('copies a session as the next one — no further than the API’s last session', async () => {
    const { actions } = await actionsFor({ ...EVERYTHING, canUpdate: false });
    select(actions, 'copy');
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Session 2 added'),
    );
    const last = await actionsFor(EVERYTHING, { ...LHR, sessionNumber: 999 });
    select(last.actions, 'copy');
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Session 999 added'),
    );
  });

  it('copies onto its package only while the package can spend a session', async () => {
    const onPackage = { ...LHR, packageId: TEST_PACKAGE_ID };
    const open = await actionsFor(EVERYTHING, onPackage, new Set([TEST_PACKAGE_ID]));
    select(open.actions, 'copy');
    await waitFor(() =>
      expect(vi.mocked(createTreatment).mock.lastCall?.[0].input.packageId).toBe(
        TEST_PACKAGE_ID,
      ),
    );
    const usedUp = await actionsFor(EVERYTHING, onPackage, new Set());
    select(usedUp.actions, 'copy');
    await waitFor(() =>
      expect(vi.mocked(createTreatment).mock.lastCall?.[0].input.packageId).toBeNull(),
    );
  });
});
