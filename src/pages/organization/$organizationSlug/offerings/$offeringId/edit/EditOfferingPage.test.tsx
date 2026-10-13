import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditOfferingPage } from './EditOfferingPage.tsx';

describe('EditOfferingPage', () => {
  it('renders nothing — the Offerings page opens the offering’s drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditOfferingPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
