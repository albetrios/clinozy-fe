import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NewPatientPage } from './NewPatientPage.tsx';

describe('NewPatientPage', () => {
  it('renders nothing — the Patients page opens the New patient drawer from the URL', async () => {
    const { container, router } = renderWithProviders(<NewPatientPage />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
