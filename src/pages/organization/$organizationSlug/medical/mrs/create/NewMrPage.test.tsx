import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewMrPage } from './NewMrPage.tsx';

describe('NewMrPage', () => {
  it('renders nothing of its own — the MRs page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewMrPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
