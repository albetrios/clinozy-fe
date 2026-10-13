import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PrescriptionPreviewPage } from './PrescriptionPreviewPage.tsx';

describe('PrescriptionPreviewPage', () => {
  it('renders nothing — Prescriptions opens the print preview from the URL', async () => {
    const { container, router } = renderWithProviders(<PrescriptionPreviewPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
