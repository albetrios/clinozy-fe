import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { RoomViewAction } from '@/shared/components/RoomToolbar/index.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { Tag } from '@/shared/icons/index.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { MedicalToolbar } from './MedicalToolbar.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));
const measured = vi.hoisted(() => ({ width: 0 }));
vi.mock('@/shared/hooks/useElementWidth/index.ts', () => ({
  useElementWidth: () => [() => undefined, measured.width],
}));

const onView = vi.fn();

/** The Medicines tab's toolbar with a view action. */
function Toolbar() {
  return (
    <MedicalToolbar
      tab="medicines"
      viewAction={
        <RoomViewAction
          actionId="discount"
          tableId="medical-medicines"
          icon={Tag}
          label="Sell all at 20% off"
          onClick={onView}
        />
      }
    />
  );
}

beforeEach(() => {
  viewport.tier = 'desktop';
  measured.width = 0;
  onView.mockReset();
});
afterEach(() => resetMedicalRoutes());

describe('MedicalToolbar', () => {
  it('carries the h1, the seven tabs, the view action and the split New', async () => {
    const user = userEvent.setup();
    const { container } = renderMedicalRoutes('/organization/acme/medical/medicines', {
      medicines: Toolbar,
    });
    expect(await screen.findByTestId('medical-medicines-new')).toHaveTextContent(
      'New medicine',
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Medical');
    const nav = screen.getByRole('navigation', { name: 'Medical sections' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Sales',
      'Medicines',
      'Purchases',
      'Suppliers',
      'Manufacturers',
      'MRs',
      'Payments',
    ]);
    const action = screen.getByTestId('medical-medicines-view-action-discount');
    expect(action).toHaveAccessibleName('Sell all at 20% off');
    await user.click(action);
    expect(onView).toHaveBeenCalledOnce();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps the current tab alone beside More on a phone, the view action in its row', async () => {
    viewport.tier = 'phone';
    measured.width = 300;
    renderMedicalRoutes('/organization/acme/medical/medicines', { medicines: Toolbar });
    const nav = await screen.findByRole('navigation', { name: 'Medical sections' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Medicines']);
    expect(within(nav).getByRole('button', { name: 'More sections' })).toBeVisible();
    // The view action shares the tab row (`medical.md:17`).
    expect(nav.parentElement).toContainElement(
      screen.getByTestId('medical-medicines-view-action-discount'),
    );
  });

  it('hides the New split without Create', async () => {
    renderMedicalRoutes(
      '/organization/acme/medical/medicines',
      { medicines: Toolbar },
      { role: 'accountant' },
    );
    await screen.findByRole('navigation', { name: 'Medical sections' });
    expect(screen.queryByTestId('medical-medicines-new')).toBeNull();
  });
});
