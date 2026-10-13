import { screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import { resetAppFixtures } from '@/shared/api/app/fixtures/world.fixtures.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import { SuppliersPage } from './SuppliersPage.tsx';

beforeEach(() => resetAppFixtures());
afterEach(() => {
  resetMedicalRoutes();
  resetAppFixtures();
});

describe('SuppliersPage', () => {
  it('lists the tab under the Medical toolbar, ending with "All suppliers loaded"', async () => {
    const { container } = renderMedicalRoutes('/organization/acme/medical/suppliers', {
      suppliers: SuppliersPage,
    });
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-suppliers-table-row')).toHaveLength(4),
    );
    expect(screen.getByTestId('medical-suppliers-page')).toHaveTextContent('NH Pharma');
    expect(screen.getByTestId('medical-suppliers-table-end')).toHaveTextContent(
      'All suppliers loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-suppliers-tab-suppliers',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('"Pay ₹2,980" while a supplier is owed opens Send payment on its oldest open bill', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const { router } = renderMedicalRoutes('/organization/acme/medical/suppliers', {
      suppliers: SuppliersPage,
    });
    const pay = await screen.findByTestId('medical-suppliers-row-action-pay');
    expect(pay).toHaveAccessibleName('Pay ₹2,980');
    await user.click(pay);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments/pay'),
    );
    // The bill's key is its purchase's id — here the fixture PO's (D153 seam).
    expect(router.state.location.search).toEqual({ bill: ref.purchaseOrder(431) });
  });

  it('the Supplier drawer offers "⚡ Pay ₹2,980" too', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const { router } = renderMedicalRoutes(
      `/organization/acme/medical/suppliers/${ref.supplier(58)}/edit`,
      { suppliers: SuppliersPage },
    );
    const pay = await screen.findByTestId('supplier-drawer-quick-fill-pay');
    expect(pay).toHaveTextContent('Pay ₹2,980');
    await user.click(pay);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments/pay'),
    );
  });
});
