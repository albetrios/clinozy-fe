import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewTreatmentPage } from './NewTreatmentPage.tsx';

describe('NewTreatmentPage', () => {
  it('renders nothing — Treatments opens the Treatment drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewTreatmentPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
