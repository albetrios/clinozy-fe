import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import {
  MedicalDeleteConfirm,
  type MedicalDeleteTarget,
} from './MedicalDeleteConfirm.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

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

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetClinicFixtures();
});

/** Confirm `target` with its first reason; resolve once the confirm has closed. */
async function confirm(target: MedicalDeleteTarget, title: string) {
  const user = setup();
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  renderMedicalDrawer(
    <MedicalDeleteConfirm target={target} onClose={onClose} onDeleted={onDeleted} />,
  );
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByText(title)).toBeInTheDocument();
  expect(dialog).toHaveTextContent(target.record ?? target.name);
  await user.click(within(dialog).getByRole('radio', { name: 'Created by mistake' }));
  await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  return { onClose };
}

describe('MedicalDeleteConfirm (medical.md:357–368)', () => {
  it('deletes a medicine with its reason and offers Undo, which restores it', async () => {
    const id = ref.medicine(456);
    await confirm(
      { kind: 'medicine', id, name: 'Glycolac Cream' },
      'Delete this medicine?',
    );
    expect(clinicFixtures.medicines.snapshot((row) => row.id === id)).toHaveLength(0);
    expect(notifyMock.undo).toHaveBeenCalledWith(
      'Glycolac Cream deleted',
      expect.objectContaining({ onUndo: expect.any(Function) }),
    );
    const [, options] = notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }];
    options.onUndo();
    await waitFor(() =>
      expect(clinicFixtures.medicines.snapshot((row) => row.id === id)).toHaveLength(1),
    );
  });

  it('names each record kind in its title', async () => {
    await confirm(
      { kind: 'mr', id: ref.medicalRep(3), name: 'Avriva Skintech · Jay' },
      'Delete this MR?',
    );
    expect(
      clinicFixtures.medicalReps.snapshot((rep) => rep.id === ref.medicalRep(3)),
    ).toHaveLength(0);
  });

  it('deletes a manufacturer no medicine names', async () => {
    const maker = await clinicFixtures.manufacturers.create({
      name: 'ZEN',
      tone: 'lav',
      isQuick: true,
    });
    await confirm(
      { kind: 'manufacturer', id: maker.id, name: 'ZEN', record: 'ZEN · 0 suppliers' },
      'Delete this manufacturer?',
    );
    expect(
      clinicFixtures.manufacturers.snapshot((row) => row.id === maker.id),
    ).toHaveLength(0);
  });

  it('deletes a supplier with nothing to settle', async () => {
    await confirm(
      { kind: 'supplier', id: ref.supplier(52), name: 'Akshar Medicines' },
      'Delete this supplier?',
    );
    expect(
      clinicFixtures.suppliers.snapshot((row) => row.id === ref.supplier(52)),
    ).toHaveLength(0);
  });
});
