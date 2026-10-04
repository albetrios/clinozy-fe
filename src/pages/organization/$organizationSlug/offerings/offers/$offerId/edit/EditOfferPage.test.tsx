import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditOfferPage } from './EditOfferPage.tsx';

describe('EditOfferPage', () => {
  it('renders nothing — the Offers page opens the offer’s drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditOfferPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
