import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditInvoicePage } from './EditInvoicePage.tsx';

describe('EditInvoicePage', () => {
  it('renders nothing — the invoices island opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditInvoicePage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
