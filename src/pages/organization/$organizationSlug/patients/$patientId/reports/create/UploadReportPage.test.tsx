import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { UploadReportPage } from './UploadReportPage.tsx';

describe('UploadReportPage', () => {
  it('renders nothing — Reports opens the Report drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<UploadReportPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
