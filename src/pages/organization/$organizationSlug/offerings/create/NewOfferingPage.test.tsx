import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewOfferingPage } from './NewOfferingPage.tsx';

describe('NewOfferingPage', () => {
  it('renders nothing — the Offerings page opens the New offering drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewOfferingPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
