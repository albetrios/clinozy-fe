import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { LeadPage } from './LeadPage.tsx';

describe('LeadPage', () => {
  it('renders nothing — the Leads page opens the lead drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<LeadPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
