import { screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import { MedicinesPage } from './MedicinesPage.tsx';

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetMedicalRoutes();
  resetClinicFixtures();
});

describe('MedicinesPage', () => {
  it('lists the tab under the Medical toolbar, ending with "All medicines loaded"', async () => {
    const { container } = renderMedicalRoutes('/organization/acme/medical/medicines', {
      medicines: MedicinesPage,
    });
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-medicines-table-row')).toHaveLength(9),
    );
    expect(screen.getByTestId('medical-medicines-page')).toHaveTextContent(
      'Glycolac Cream',
    );
    expect(screen.getByTestId('medical-medicines-table-end')).toHaveTextContent(
      'All medicines loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-medicines-tab-medicines',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('a batch expiring within 90 days can go back to its supplier', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderMedicalRoutes('/organization/acme/medical/medicines', {
      medicines: MedicinesPage,
    });
    const [action] = await screen.findAllByTestId(
      'medical-medicines-row-action-return-expiring',
    );
    expect(action).toHaveAccessibleName('Return expiring stock to supplier');
    await user.click(action as HTMLElement);
    expect(await screen.findByTestId('expiring-return-drawer')).toHaveTextContent(
      'Return expiring stock',
    );
  });
});
