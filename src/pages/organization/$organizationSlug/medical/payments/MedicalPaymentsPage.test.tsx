import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import { MedicalPaymentsPage } from './MedicalPaymentsPage.tsx';

afterEach(() => resetMedicalRoutes());

describe('MedicalPaymentsPage', () => {
  it('is the Payments tab under the Medical toolbar, its New sale primary', async () => {
    const { container } = renderMedicalRoutes('/organization/acme/medical/payments', {
      payments: MedicalPaymentsPage,
    });
    expect(await screen.findByTestId('medical-payments-new')).toHaveTextContent(
      'New sale',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Payments');
    expect(screen.getByText('No Medical payments yet')).toBeVisible();
    expect(await axe(container)).toHaveNoViolations();
  });
});
