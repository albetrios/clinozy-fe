import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditTreatmentPage } from './EditTreatmentPage.tsx';

describe('EditTreatmentPage', () => {
  it('renders nothing — Treatments opens the Treatment drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditTreatmentPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
