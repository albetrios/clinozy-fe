import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewLeadPage } from './NewLeadPage.tsx';

describe('NewLeadPage', () => {
  it('renders nothing — the Leads page opens the New lead drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewLeadPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
