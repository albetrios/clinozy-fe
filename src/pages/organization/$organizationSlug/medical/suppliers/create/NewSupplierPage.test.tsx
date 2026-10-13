import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewSupplierPage } from './NewSupplierPage.tsx';

describe('NewSupplierPage', () => {
  it('renders nothing of its own — the Suppliers page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewSupplierPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
