import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditSupplierPage } from './EditSupplierPage.tsx';

describe('EditSupplierPage', () => {
  it('renders nothing of its own — the Suppliers page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditSupplierPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
