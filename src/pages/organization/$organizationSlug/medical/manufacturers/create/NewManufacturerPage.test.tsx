import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewManufacturerPage } from './NewManufacturerPage.tsx';

describe('NewManufacturerPage', () => {
  it('renders nothing of its own — the Manufacturers page opens the drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewManufacturerPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
