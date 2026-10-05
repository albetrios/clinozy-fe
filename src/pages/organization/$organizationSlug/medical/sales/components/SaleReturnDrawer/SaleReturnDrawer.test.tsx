import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { fetchMedicalSale } from '../../../shared/medical-api.ts';
import { SaleReturnDrawer } from './SaleReturnDrawer.tsx';

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
const D = 'sale-return-drawer';
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

describe('SaleReturnDrawer (medical.md:283–295)', () => {
  it('asks what is coming back first, then refunds everything back: "₹1,200 refunded · stock added back"', async () => {
    const user = setup();
    const onClose = vi.fn();
    // #983, paid ₹1,200: Admosh ₹550 + Uncap ₹650.
    const sale = await fetchMedicalSale(ref.medicalSale(983));
    renderMedicalDrawer(<SaleReturnDrawer open sale={sale} onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'Return from patient',
    );
    expect(drawer).toHaveTextContent(
      'Rhea Shah · returned stock goes back into its batch',
    );
    expect(within(drawer).getAllByTestId(`${D}-lines-row`)).toHaveLength(2);

    // Nothing back yet: the save says what is missing.
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Enter what is being returned');
    expect(onClose).not.toHaveBeenCalled();

    await user.click(within(drawer).getByTestId(`${D}-quick-fill-everything`));
    expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent('Refund ₹1,200');
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Unused · ₹1,200',
    );
    expect(await axeForDialog(drawer)).toHaveNoViolations();

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('₹1,200 refunded · stock added back');
    expect((await fetchMedicalSale(ref.medicalSale(983))).returned).toBe(120_000);
  });

  it('a damaged return on an unpaid sale lowers its due: "… returned · stock written off"', async () => {
    const user = setup();
    const onClose = vi.fn();
    // #978, unpaid: return one of the two Glycolac.
    const sale = await fetchMedicalSale(ref.medicalSale(978));
    renderMedicalDrawer(<SaleReturnDrawer open sale={sale} onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    const [, glycolac] = within(drawer).getAllByTestId(`${D}-lines-return-increase`);
    if (!glycolac) throw new Error('expected the Glycolac line');
    await user.click(glycolac);

    await user.click(within(drawer).getByTestId(`${D}-step-reason-trigger`));
    await user.click(within(drawer).getByTestId(`${D}-reason-damaged`));
    await user.click(within(drawer).getByTestId(`${D}-mode-upi`));
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(
      'Damaged · ₹162',
    );

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('₹162 returned · stock written off');
    const batch = (await clinicFixtures.medicines.get(ref.medicine(456))).batches[0];
    expect(batch?.qty).toBe(3);
    expect((await fetchMedicalSale(ref.medicalSale(978))).due).toBe(40_100);
  });

  it('opens read-only for a viewer, and shimmers until the sale is read', async () => {
    const sale = await fetchMedicalSale(ref.medicalSale(983));
    const view = renderMedicalDrawer(
      <SaleReturnDrawer open sale={sale} onClose={vi.fn()} />,
      { role: 'accountant' },
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).queryByTestId(`${D}-save`)).not.toBeInTheDocument();
    view.unmount();
    renderMedicalDrawer(<SaleReturnDrawer open sale={undefined} onClose={vi.fn()} />);
    expect(await screen.findByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });
});
