import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import {
  appFixtures,
  resetAppFixtures,
} from '@/shared/api/app/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import { ManufacturersPage } from '../../manufacturers/ManufacturersPage.tsx';
import { MedicinesPage } from '../../medicines/MedicinesPage.tsx';
import { MrsPage } from '../../mrs/MrsPage.tsx';
import { SuppliersPage } from '../../suppliers/SuppliersPage.tsx';
import { renderMedicalRoutes, resetMedicalRoutes } from './medical-test-router.tsx';

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
  TOAST_DURATION_MS: { default: 5_200, error: 9_000, undo: 10_000 },
}));

const PAGES = {
  medicines: MedicinesPage,
  suppliers: SuppliersPage,
  manufacturers: ManufacturersPage,
  mrs: MrsPage,
};
const ROOM = '/organization/acme/medical';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const rowOf = async (tab: string, text: string) => {
  await waitFor(
    () =>
      expect(
        screen
          .getAllByTestId(`medical-${tab}-table-row`)
          .some((row) => row.textContent?.includes(text)),
      ).toBe(true),
    { timeout: 4000 },
  );
  const row = screen
    .getAllByTestId(`medical-${tab}-table-row`)
    .find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no ${tab} row with ${text}`);
  return row;
};

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetAppFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetAppFixtures();
});

describe('Medical drawers over their tabs (KICKOFF §6.7, D24)', () => {
  it('a medicine row opens Edit medicine over the list; Cancel goes back with the list’s params', async () => {
    const user = setup();
    const { router } = renderMedicalRoutes(`${ROOM}/medicines?q=gly`, PAGES);
    await user.click(await rowOf('medicines', 'Glycolac Cream'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/medicines/${ref.medicine(456)}/edit`,
      ),
    );
    const drawer = await screen.findByTestId('medicine-drawer');
    await waitFor(() =>
      expect(within(drawer).getByTestId('medicine-drawer-title')).toHaveTextContent(
        'Edit medicine',
      ),
    );
    await user.click(within(drawer).getByTestId('medicine-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/medicines`));
    expect(router.state.location.search).toMatchObject({ q: 'gly' });
  });

  it('"New medicine" opens the create drawer with the search’s name', async () => {
    renderMedicalRoutes(`${ROOM}/medicines/create?name=Azel%20cream`, PAGES);
    const drawer = await screen.findByTestId('medicine-drawer');
    expect(within(drawer).getByTestId('medicine-drawer-title')).toHaveTextContent(
      'New medicine',
    );
    expect(within(drawer).getByTestId('medicine-drawer-name')).toHaveValue('Azel cream');
  });

  it('a medicine’s Delete asks for a reason and the row leaves the list', async () => {
    const user = setup();
    renderMedicalRoutes(`${ROOM}/medicines`, PAGES);
    const row = await rowOf('medicines', 'Epriva Tab');
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete this medicine?');
    await user.click(within(confirm).getByRole('radio', { name: 'Duplicate' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(
        screen
          .queryAllByTestId('medical-medicines-table-row')
          .some((candidate) => candidate.textContent?.includes('Epriva Tab')),
      ).toBe(false),
    );
    expect(notifyMock.undo).toHaveBeenCalledWith('Epriva Tab deleted', expect.anything());
    expect(
      appFixtures.medicines.snapshot((m) => m.id === ref.medicine(455)),
    ).toHaveLength(0);
  });

  it('offers Delete only on a supplier with nothing due and no order to settle', async () => {
    renderMedicalRoutes(`${ROOM}/suppliers`, PAGES);
    const owing = await rowOf('suppliers', 'Shree Ramdev Medical Agency');
    expect(
      within(owing).queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument();
    const clear = await rowOf('suppliers', 'Akshar Medicines');
    expect(within(clear).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('offers Delete only on a manufacturer no medicine names, and opens Edit from a row', async () => {
    const user = setup();
    await appFixtures.manufacturers.create({
      name: 'ZEN',
      tone: 'lav',
      isQuick: true,
    });
    const { router } = renderMedicalRoutes(`${ROOM}/manufacturers`, PAGES);
    const used = await rowOf('manufacturers', 'ALVI');
    expect(
      within(used).queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument();
    const unused = await rowOf('manufacturers', 'ZEN');
    expect(within(unused).getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    await user.click(used);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${ROOM}/manufacturers/${ref.manufacturer(1)}/edit`,
      ),
    );
    expect(await screen.findByTestId('manufacturer-drawer')).toHaveTextContent(
      'Edit manufacturer',
    );
  });

  it('"Log visit" opens Log MR visit; a row opens Edit MR', async () => {
    const user = setup();
    const { router } = renderMedicalRoutes(`${ROOM}/mrs`, PAGES);
    const row = await rowOf('mrs', 'Alvio Pharma · Rakesh');
    await user.click(within(row).getByRole('button', { name: 'Log visit' }));
    const visit = await screen.findByTestId('rep-visit-drawer');
    await waitFor(() => expect(visit).toHaveTextContent('Alvio Pharma · Rakesh'));
    await user.click(within(visit).getByTestId('rep-visit-drawer-dismiss'));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${ROOM}/mrs`));

    await user.click(await rowOf('mrs', 'Atopic Dermocare · Meet'));
    const edit = await screen.findByTestId('rep-drawer');
    await waitFor(() => expect(edit).toHaveTextContent('Edit MR'));
  });

  it('Edit supplier’s "New purchase order" opens one on that supplier', async () => {
    const user = setup();
    const { router } = renderMedicalRoutes(
      `${ROOM}/suppliers/${ref.supplier(52)}/edit`,
      PAGES,
    );
    // The drawer's shell shows first; the loaded drawer replaces it.
    await user.click(
      await screen.findByTestId(
        'supplier-drawer-quick-fill-new-order',
        {},
        { timeout: 4000 },
      ),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ROOM}/purchases/create`),
    );
    expect(router.state.location.search).toMatchObject({ supplier: ref.supplier(52) });
  });
});
