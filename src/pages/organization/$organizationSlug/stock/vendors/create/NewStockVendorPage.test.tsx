import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewStockVendorPage } from './NewStockVendorPage.tsx';

describe('NewStockVendorPage', () => {
  it('renders nothing of its own — the Vendors page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewStockVendorPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
