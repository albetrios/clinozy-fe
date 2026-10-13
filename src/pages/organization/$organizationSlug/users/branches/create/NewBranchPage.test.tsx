import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewBranchPage } from './NewBranchPage.tsx';

describe('NewBranchPage', () => {
  it('renders nothing — Branches opens the New branch drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewBranchPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
