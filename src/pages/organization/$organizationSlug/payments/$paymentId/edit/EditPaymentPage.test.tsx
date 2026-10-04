import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditPaymentPage } from './EditPaymentPage.tsx';

describe('EditPaymentPage', () => {
  it('renders nothing — the Payments ledger opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditPaymentPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
