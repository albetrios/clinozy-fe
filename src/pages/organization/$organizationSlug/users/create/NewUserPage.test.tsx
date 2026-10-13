import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewUserPage } from './NewUserPage.tsx';

describe('NewUserPage', () => {
  it('renders nothing — the Team opens the New user drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewUserPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
