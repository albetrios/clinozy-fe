import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewInvoicePage } from './NewInvoicePage.tsx';

describe('NewInvoicePage', () => {
  it('renders nothing — the invoices island opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewInvoicePage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
