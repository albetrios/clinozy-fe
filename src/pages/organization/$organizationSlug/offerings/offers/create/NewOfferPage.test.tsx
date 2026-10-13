import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewOfferPage } from './NewOfferPage.tsx';

describe('NewOfferPage', () => {
  it('renders nothing — the Offers page opens the New offer drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewOfferPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
