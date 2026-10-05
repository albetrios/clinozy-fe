import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchMedicine } from '@/shared/api/clinic/medicines-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { fetchSupplierAccount } from '../../../shared/medical-api.ts';
import { ExpiringReturnDrawer } from './ExpiringReturnDrawer.tsx';

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

const D = 'expiring-return-drawer';
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

describe('ExpiringReturnDrawer (medical.md:297–309)', () => {
  it('returns the whole batch to its supplier for a credit of qty × rate', async () => {
    const user = setup();
    const onClose = vi.fn();
    // Glycolac Cream: 3 left in 026-312 at ₹123, bought from Akshar Medicines.
    const medicine = await fetchMedicine(ref.medicine(456));
    renderMedicalDrawer(<ExpiringReturnDrawer medicine={medicine} onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByTestId(`${D}-supplier`)).toHaveTextContent('Akshar Medicines'),
    );
    const drawer = screen.getByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'Return expiring stock',
    );
    expect(drawer).toHaveTextContent(
      /Glycolac Cream · batch 026-312 · expires \d\d\/\d\d/,
    );
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent('Credit ₹369');
    expect(within(drawer).getByTestId(`${D}-badges`)).toHaveTextContent(/days? left/);
    expect(within(drawer).getByTestId(`${D}-credit`)).toHaveTextContent('₹369');
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Credit reduces what you owe Akshar Medicines',
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith(
      '3 returned · ₹369 credit from Akshar Medicines',
    );
    const saved = await clinicFixtures.medicines.get(ref.medicine(456));
    expect(saved.batches[0]?.qty).toBe(0);
    const [credit] = await fetchSupplierAccount(ref.supplier(52));
    expect(credit).toMatchObject({ kind: 'credit', batchNo: '026-312', amount: 36_900 });
  });

  it('starts on the cheapest supplier and caps the quantity at the batch', async () => {
    const user = setup();
    // Uncap: 8 in CSH26044 at ₹440; K R Medical Agency ₹440 · Akshar ₹452.
    const medicine = await fetchMedicine(ref.medicine(458));
    renderMedicalDrawer(<ExpiringReturnDrawer medicine={medicine} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId(`${D}-supplier`)).toHaveTextContent('K R Medical Agency'),
    );
    const drawer = screen.getByTestId(D);
    expect(drawer).toHaveTextContent('of 8');
    const qty = within(drawer).getByTestId(`${D}-qty`);
    await user.clear(qty);
    await user.type(qty, '2');
    expect(within(drawer).getByTestId(`${D}-credit`)).toHaveTextContent('₹880');
    await user.click(within(drawer).getByTestId(`${D}-qty-increase`));
    expect(within(drawer).getByTestId(`${D}-credit`)).toHaveTextContent('₹1,320');
  });

  it('is closed without a medicine, and read-only for a viewer', async () => {
    const view = renderMedicalDrawer(
      <ExpiringReturnDrawer medicine={null} onClose={vi.fn()} />,
    );
    expect(screen.queryByTestId(D)).not.toBeInTheDocument();
    view.unmount();
    const medicine = await fetchMedicine(ref.medicine(456));
    renderMedicalDrawer(<ExpiringReturnDrawer medicine={medicine} onClose={vi.fn()} />, {
      role: 'accountant',
    });
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).queryByTestId(`${D}-save`)).not.toBeInTheDocument();
  });
});
