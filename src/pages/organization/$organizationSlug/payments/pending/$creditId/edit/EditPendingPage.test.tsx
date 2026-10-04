import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditPendingPage } from './EditPendingPage.tsx';

describe('EditPendingPage', () => {
  it('renders nothing — the Pending page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditPendingPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
