import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewStockPurchasePage } from './NewStockPurchasePage.tsx';

describe('NewStockPurchasePage', () => {
  it('renders nothing of its own — the Purchases page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewStockPurchasePage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
