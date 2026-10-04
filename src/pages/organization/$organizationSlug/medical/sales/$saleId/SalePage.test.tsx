import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { SalePage } from './SalePage.tsx';

describe('SalePage', () => {
  it('renders nothing of its own — the Sales page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<SalePage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
