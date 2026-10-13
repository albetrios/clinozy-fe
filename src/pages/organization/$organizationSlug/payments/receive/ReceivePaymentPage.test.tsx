import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { ReceivePaymentPage } from './ReceivePaymentPage.tsx';

describe('ReceivePaymentPage', () => {
  it('renders nothing — the Payments ledger opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<ReceivePaymentPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
