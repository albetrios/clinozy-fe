import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditStockItemPage } from './EditStockItemPage.tsx';

describe('EditStockItemPage', () => {
  it('renders nothing of its own — the Items page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditStockItemPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
