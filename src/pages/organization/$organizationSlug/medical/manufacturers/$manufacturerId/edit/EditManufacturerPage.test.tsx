import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditManufacturerPage } from './EditManufacturerPage.tsx';

describe('EditManufacturerPage', () => {
  it('renders nothing of its own — the Manufacturers page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditManufacturerPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
