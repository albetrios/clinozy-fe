import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditMrPage } from './EditMrPage.tsx';

describe('EditMrPage', () => {
  it('renders nothing of its own — the MRs page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditMrPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
