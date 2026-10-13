import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditPurchaseOrderPage } from './EditPurchaseOrderPage.tsx';

describe('EditPurchaseOrderPage', () => {
  it('renders nothing of its own — the Purchases page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditPurchaseOrderPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
