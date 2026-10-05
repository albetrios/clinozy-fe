import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { pickerTestIds } from '@/shared/components/Picker/index.ts';
import { Calendar, UserPlus, Wallet } from '@/shared/icons/index.ts';
import type {
  SectionBarEntry,
  SectionBarNav,
} from '@/shared/layouts/AppLayout/section-bar-nav.ts';
import { LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PinnedTabs } from './PinnedTabs.tsx';

const MORE = pickerTestIds('nav-more');

/** A pinned room; its label key reads back as the label (no such key exists). */
function pin(
  id: string,
  label: string,
  icon: SectionBarEntry['icon'],
  tone: SectionBarEntry['tone'],
): SectionBarEntry {
  return {
    id,
    to: `/organization/$organizationSlug/${id}`,
    section: null,
    icon,
    labelNs: LAYOUT_NS,
    labelKey: label,
    tone,
    descriptionKey: null,
  };
}

const PINS = [
  pin('appointments', 'Appointments', Calendar, 'sky'),
  pin('leads', 'Leads', UserPlus, 'lav'),
  pin('payments', 'Payments', Wallet, 'peach'),
];

const NAV: SectionBarNav = {
  entries: PINS,
  pinned: PINS,
  current: null,
  currentUnpinned: false,
  canPin: true,
  isPinned: () => true,
  togglePin: () => {},
};

/** Room for the first tab and "More" only: the other two pins fold. */
function renderTabs(available: number | null = 260) {
  return renderWithProviders(
    <nav aria-label="Pinned rooms">
      <PinnedTabs
        nav={NAV}
        organizationSlug="acme"
        available={available}
        fontFamily="sans-serif"
      />
    </nav>,
  );
}

describe('PinnedTabs', () => {
  it('shows every pin as a tab until the space is measured', async () => {
    const { container } = renderTabs(null);
    expect(await screen.findByTestId('nav-appointments')).toBeInTheDocument();
    expect(screen.getByTestId('nav-leads')).toBeInTheDocument();
    expect(screen.getByTestId('nav-payments')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-more')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('folds the pins that do not fit into "More", a menu that opens the room', async () => {
    const user = userEvent.setup();
    const { router } = renderTabs();
    expect(await screen.findByTestId('nav-appointments')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-leads')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('nav-more'));
    const panel = await screen.findByTestId(MORE.panel);
    // A menu: the folded rooms, no check column.
    expect(screen.getByTestId(MORE.option('leads'))).toHaveTextContent('Leads');
    expect(screen.getByTestId(MORE.option('payments'))).not.toHaveAttribute(
      'aria-checked',
    );
    expect(await axeForDialog(panel)).toHaveNoViolations();

    await user.click(screen.getByTestId(MORE.option('payments')));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments'),
    );
  });
});
