import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

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
import { PrescriptionsToFill } from './PrescriptionsToFill.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const TRIGGER = 'medical-sales-view-action-prescriptions';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetMedicalRoutes();
  resetClinicFixtures();
});

describe('PrescriptionsToFill (medical.md:417–431)', () => {
  it('lists the unfilled prescriptions, newest first, and hands back the one picked', async () => {
    const user = setup();
    const onPick = vi.fn();
    const { container } = renderMedicalDrawer(<PrescriptionsToFill onPick={onPick} />);
    const trigger = await screen.findByTestId(TRIGGER);
    expect(trigger).toHaveAccessibleName('Prescriptions to fill');
    expect(await axe(container)).toHaveNoViolations();

    await user.click(trigger);
    const panel = await screen.findByTestId('prescriptions-to-fill-panel');
    const [newest] = within(panel).getAllByRole('option');
    expect(newest).toHaveTextContent('Harsh Trivedi');
    expect(newest).toHaveTextContent(/Rx #501 · .+ · Tretinoin 0\.025% cream 20 g/);
    if (!newest) throw new Error('expected a prescription');
    await user.click(newest);
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: ref.prescription(501), seq: 501 }),
    );
  });

  it('hides while every prescription is filled', async () => {
    for (const rx of clinicFixtures.prescriptions.snapshot()) {
      await clinicFixtures.prescriptions.update(rx.id, { items: [] });
    }
    renderMedicalDrawer(<PrescriptionsToFill onPick={vi.fn()} />);
    await waitFor(() => expect(screen.queryByTestId(TRIGGER)).not.toBeInTheDocument());
  });
});
