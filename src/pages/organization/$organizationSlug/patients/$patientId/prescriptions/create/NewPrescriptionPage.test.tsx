import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewPrescriptionPage } from './NewPrescriptionPage.tsx';

describe('NewPrescriptionPage', () => {
  it('renders nothing — Prescriptions opens the Prescription drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewPrescriptionPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
