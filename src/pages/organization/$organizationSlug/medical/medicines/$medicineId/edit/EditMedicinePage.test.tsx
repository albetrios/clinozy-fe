import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditMedicinePage } from './EditMedicinePage.tsx';

describe('EditMedicinePage', () => {
  it('renders nothing of its own — the Medicines page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditMedicinePage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
