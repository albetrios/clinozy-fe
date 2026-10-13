import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { ReportViewPage } from './ReportViewPage.tsx';

describe('ReportViewPage', () => {
  it('renders nothing — Reports opens Report view from the URL', async () => {
    const { container, router } = renderWithProviders(<ReportViewPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
