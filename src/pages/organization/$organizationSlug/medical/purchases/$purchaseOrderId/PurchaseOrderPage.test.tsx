import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PurchaseOrderPage } from './PurchaseOrderPage.tsx';

describe('PurchaseOrderPage', () => {
  it('renders nothing of its own — the Purchases page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<PurchaseOrderPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
