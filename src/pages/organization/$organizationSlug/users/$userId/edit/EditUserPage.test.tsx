import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditUserPage } from './EditUserPage.tsx';

describe('EditUserPage', () => {
  it('renders nothing — the Users page opens the member drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditUserPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
