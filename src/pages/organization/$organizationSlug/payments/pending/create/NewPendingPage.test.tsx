import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewPendingPage } from './NewPendingPage.tsx';

describe('NewPendingPage', () => {
  it('renders nothing — the Pending page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewPendingPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
