import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditStockVendorPage } from './EditStockVendorPage.tsx';

describe('EditStockVendorPage', () => {
  it('renders nothing of its own — the Vendors page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditStockVendorPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
