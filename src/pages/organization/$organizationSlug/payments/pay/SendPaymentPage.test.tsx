import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { SendPaymentPage } from './SendPaymentPage.tsx';

describe('SendPaymentPage', () => {
  it('renders nothing — the Payments ledger opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<SendPaymentPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
