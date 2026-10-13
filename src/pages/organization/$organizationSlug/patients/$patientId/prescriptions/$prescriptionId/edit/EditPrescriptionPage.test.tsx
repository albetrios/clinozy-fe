import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { EditPrescriptionPage } from './EditPrescriptionPage.tsx';

describe('EditPrescriptionPage', () => {
  it('renders nothing — Prescriptions opens the Prescription drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<EditPrescriptionPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
