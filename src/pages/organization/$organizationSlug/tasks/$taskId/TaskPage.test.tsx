import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { TaskPage } from './TaskPage.tsx';

describe('TaskPage', () => {
  it('renders nothing — the Tasks page opens the task drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<TaskPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
