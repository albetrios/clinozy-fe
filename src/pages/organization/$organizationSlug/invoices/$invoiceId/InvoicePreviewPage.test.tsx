import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { InvoicePreviewPage } from './InvoicePreviewPage.tsx';

describe('InvoicePreviewPage', () => {
  it('renders nothing of its own — the invoices island opens the preview from the URL', async () => {
    const { container, router } = renderWithProviders(<InvoicePreviewPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
