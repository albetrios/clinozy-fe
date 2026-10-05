import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { fetchMedicalSale } from '../../../shared/medical-api.ts';
import { SaleDrawer } from './SaleDrawer.tsx';

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

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');
const D = 'sale-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetMedicalRoutes();
  resetClinicFixtures();
});

describe('SaleDrawer (medical.md:333–338)', () => {
  it('an unpaid sale: its badges and medicines, "Collect ₹563" on the ledger with Undo', async () => {
    const user = setup();
    const sale = await fetchMedicalSale(ref.medicalSale(978));
    renderMedicalDrawer(
      <SaleDrawer open sale={sale} onClose={vi.fn()} onReturn={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Sale');
    expect(within(drawer).getByTestId(`${D}-tag`)).toHaveTextContent('#978');
    expect(drawer).toHaveTextContent('Dharti Galani');
    const badges = within(drawer).getByTestId(`${D}-badges`);
    expect(badges).toHaveTextContent('Unpaid');
    expect(badges).toHaveTextContent('Invoice #788 · in patient file');
    expect(badges).toHaveTextContent('₹563');
    expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(2);
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      '2 medicines · ₹563',
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    const collect = within(drawer).getByTestId(`${D}-save`);
    expect(collect).toHaveTextContent('Collect ₹563');
    await user.click(collect);
    await waitFor(() =>
      expect(notifyMock.undo).toHaveBeenCalledWith(
        '₹563 received',
        expect.objectContaining({ onUndo: expect.any(Function) }),
      ),
    );
    expect((await fetchMedicalSale(ref.medicalSale(978))).status).toBe('paid');

    const [, options] = notifyMock.undo.mock.calls[0] as [string, { onUndo: () => void }];
    options.onUndo();
    await waitFor(async () =>
      expect((await fetchMedicalSale(ref.medicalSale(978))).status).toBe('unpaid'),
    );
  });

  it('offers Void on an unpaid sale with nothing paid or returned', async () => {
    const user = setup();
    const sale = await fetchMedicalSale(ref.medicalSale(978));
    renderMedicalDrawer(
      <SaleDrawer open sale={sale} onClose={vi.fn()} onReturn={vi.fn()} />,
    );
    const drawer = await screen.findByTestId(D);
    const voidButton = within(drawer).getByTestId(`${D}-delete`);
    expect(voidButton).toHaveTextContent('Void sale');
    await user.click(voidButton);
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Void this sale?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('2 medicines · ₹563');
  });

  it('a paid sale offers "Return medicines" and its returned amount', async () => {
    const user = setup();
    const onReturn = vi.fn();
    const sale = await fetchMedicalSale(ref.medicalSale(983));
    renderMedicalDrawer(
      <SaleDrawer
        open
        sale={{ ...sale, returned: 23_900 }}
        onClose={vi.fn()}
        onReturn={onReturn}
      />,
    );
    const drawer = await screen.findByTestId(D);
    const badges = within(drawer).getByTestId(`${D}-badges`);
    expect(badges).toHaveTextContent('Paid');
    expect(badges).toHaveTextContent('Returned ₹239');
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(onReturn).toHaveBeenCalledWith(expect.objectContaining({ id: sale.id }));
  });

  it('a walk-in’s sale names no patient file, and a viewer gets only Close', async () => {
    const sale = await fetchMedicalSale(ref.medicalSale(978));
    renderMedicalDrawer(
      <SaleDrawer
        open
        sale={{ ...sale, customer: null }}
        onClose={vi.fn()}
        onReturn={vi.fn()}
      />,
      { role: 'accountant' },
    );
    const drawer = await screen.findByTestId(D);
    expect(drawer).toHaveTextContent('Walk-in customer');
    expect(within(drawer).getByTestId(`${D}-badges`)).not.toHaveTextContent('Invoice');
    expect(within(drawer).queryByTestId(`${D}-save`)).not.toBeInTheDocument();
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
    expect(within(drawer).getByTestId(`${D}-dismiss`)).toHaveTextContent('Close');
  });

  it('shimmers until the sale is read', async () => {
    renderMedicalDrawer(
      <SaleDrawer open sale={undefined} onClose={vi.fn()} onReturn={vi.fn()} />,
    );
    expect(await screen.findByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });
});
