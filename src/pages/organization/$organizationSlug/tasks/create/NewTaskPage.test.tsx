import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewTaskPage } from './NewTaskPage.tsx';

describe('NewTaskPage', () => {
  it('renders nothing — the Tasks page opens the New task drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewTaskPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
