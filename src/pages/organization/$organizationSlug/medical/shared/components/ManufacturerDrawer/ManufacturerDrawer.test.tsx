import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import {
  appFixtures,
  resetAppFixtures,
} from '@/shared/api/app/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { fetchManufacturer } from '../../medical-api.ts';
import { ManufacturerDrawer } from './ManufacturerDrawer.tsx';

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

const D = 'manufacturer-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetAppFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetAppFixtures();
});

describe('ManufacturerDrawer (medical.md:208–222)', () => {
  it('takes the name in upper case, asks for it when empty, and saves the connections', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(<ManufacturerDrawer mode="create" open onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'New manufacturer',
    );
    expect(within(drawer).getByTestId(`${D}-colour-lav`)).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a name');

    await user.type(within(drawer).getByTestId(`${D}-name`), 'acme');
    expect(within(drawer).getByTestId(`${D}-name`)).toHaveValue('ACME');
    await user.click(within(drawer).getByTestId(`${D}-colour-sky`));
    expect(await axeForDialog(drawer)).toHaveNoViolations();
    await user.click(within(drawer).getByTestId(`${D}-save`));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Manufacturer saved · connections updated',
    );
    expect(
      appFixtures.manufacturers.snapshot((maker) => maker.name === 'ACME')[0],
    ).toMatchObject({ tone: 'sky', isQuick: false });
  });

  it('edits the links on the suppliers and MRs, and sums them in the footer', async () => {
    const user = setup();
    const onClose = vi.fn();
    const maker = await fetchManufacturer(ref.manufacturer(6));
    renderMedicalDrawer(
      <ManufacturerDrawer mode="edit" manufacturer={maker} open onClose={onClose} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'BLA · 2 suppliers · 1 MR',
    );
    // A maker with medicines can't be deleted.
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();

    await user.click(within(drawer).getByTestId(`${D}-step-connections-trigger`));
    expect(within(drawer).getByTestId(`${D}-medicines`)).toHaveTextContent(
      /medicines? in Stock/,
    );
    await user.click(within(drawer).getByTestId(`${D}-suppliers`));
    await user.click(await screen.findByRole('option', { name: /K R Medical Agency/ }));
    await user.keyboard('{Escape}');
    await user.click(within(drawer).getByTestId(`${D}-save`));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const kr = await appFixtures.suppliers.get(ref.supplier(61));
    expect(kr.manufacturerIds).toContain(ref.manufacturer(6));
  });

  it('stacked: "Back" · "Add manufacturer", the new maker handed back', async () => {
    const user = setup();
    const onSaved = vi.fn();
    renderMedicalDrawer(
      <ManufacturerDrawer
        mode="create"
        prefill={{ name: 'zen' }}
        open
        onClose={vi.fn()}
        stacked
        onSaved={onSaved}
        testId={`${D}-stacked`}
      />,
    );
    const drawer = await screen.findByTestId(`${D}-stacked`);
    expect(within(drawer).getByTestId(`${D}-stacked-name`)).toHaveValue('ZEN');
    expect(within(drawer).getByTestId(`${D}-stacked-dismiss`)).toHaveTextContent('Back');
    await user.click(within(drawer).getByTestId(`${D}-stacked-save`));
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'ZEN' })),
    );
  });
});
