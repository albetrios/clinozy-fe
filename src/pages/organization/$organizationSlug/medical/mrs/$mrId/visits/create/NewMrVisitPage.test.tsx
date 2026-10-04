import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewMrVisitPage } from './NewMrVisitPage.tsx';

describe('NewMrVisitPage', () => {
  it('renders nothing of its own — the MRs page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewMrVisitPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
