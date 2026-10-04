import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditBranchPage } from './EditBranchPage.tsx';

describe('EditBranchPage', () => {
  it('renders nothing — Branches opens the branch drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditBranchPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
