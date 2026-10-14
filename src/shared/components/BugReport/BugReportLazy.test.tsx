import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { BUG_REPORT_TEST_IDS } from './bug-report.constants.ts';
import { BugReportLazy } from './BugReportLazy.tsx';

describe('BugReportLazy', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
  });

  it('renders nothing signed out — there is nobody to report as', () => {
    const { container } = renderWithProviders(<BugReportLazy />);
    expect(container.querySelector('[data-slot="feedback-trigger"]')).toBeNull();
    expect(screen.queryByTestId(BUG_REPORT_TEST_IDS.trigger)).not.toBeInTheDocument();
  });

  it('loads the trigger, with its copy, for a signed-in person', async () => {
    useAuthStore.setState({
      user: { id: 'usr_bbbbbbbbbbbbbbbbbbbbb', email: 'asha@example.com', role: 'user' },
    });
    renderWithProviders(<BugReportLazy />);

    // Icon only: the copy is the button's accessible name.
    expect(await screen.findByTestId(BUG_REPORT_TEST_IDS.trigger)).toHaveAccessibleName(
      'Report a bug',
    );
  });
});
