import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('../../../shared/medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPrescriptionsToFill: vi.fn(),
}));

import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  prescriptionToFill,
  TEST_PRESCRIPTION_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { listPrescriptionsToFill } from '../../../shared/medical-api.ts';
import { PrescriptionsToFill } from './PrescriptionsToFill.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const TRIGGER = 'medical-sales-view-action-prescriptions';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  signInTestMember();
  vi.mocked(listPrescriptionsToFill).mockResolvedValue([
    prescriptionToFill({
      medicines: ['Azelaic gel 15g', 'Tretinoin 0.025% cream 20 g'],
    }),
    prescriptionToFill({
      id: 'rx_rx5700000000000000000',
      seq: 57,
      patientName: 'Harsh Trivedi',
      date: '2026-10-08',
    }),
  ]);
});
afterEach(() => {
  resetMedicalRoutes();
  vi.mocked(listPrescriptionsToFill).mockReset();
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
    const [newest, older] = within(panel).getAllByRole('option');
    expect(newest).toHaveTextContent('Priya Shah');
    expect(newest).toHaveTextContent(
      /Rx #58 · .+ · Azelaic gel 15g, Tretinoin 0\.025% cream 20 g/,
    );
    expect(older).toHaveTextContent('Harsh Trivedi');
    if (!newest) throw new Error('expected a prescription');
    await user.click(newest);
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: TEST_PRESCRIPTION_ID, seq: 58 }),
    );
  });

  it('hides while every prescription is filled', async () => {
    vi.mocked(listPrescriptionsToFill).mockResolvedValue([]);
    renderMedicalDrawer(<PrescriptionsToFill onPick={vi.fn()} />);
    await waitFor(() => expect(listPrescriptionsToFill).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId(TRIGGER)).not.toBeInTheDocument());
  });
});
