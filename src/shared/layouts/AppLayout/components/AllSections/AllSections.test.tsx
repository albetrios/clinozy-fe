import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { House, UserPlus } from '@/shared/icons/index.ts';
import type {
  SectionBarEntry,
  SectionBarNav,
} from '@/shared/layouts/AppLayout/section-bar-nav.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { AllSectionsList, AllSectionsSheet } from './AllSections.tsx';

const room = (
  id: 'today' | 'leads',
  icon: SectionBarEntry['icon'],
  tone: SectionBarEntry['tone'],
): SectionBarEntry => ({
  id,
  to: `/organization/$organizationSlug/${id}`,
  section: id,
  icon,
  labelNs: 'clinic',
  labelKey: `sections.${id}.label`,
  tone,
  descriptionKey: `sections.${id}.description`,
});

const today = room('today', House, 'butter');
const leads = room('leads', UserPlus, 'lav');

function navWith(overrides: Partial<SectionBarNav> = {}): SectionBarNav {
  return {
    entries: [today, leads],
    pinned: [leads],
    current: today,
    currentUnpinned: true,
    isPinned: (entry) => entry === leads,
    togglePin: vi.fn(),
    ...overrides,
  };
}

describe('AllSectionsList', () => {
  it('lists the rooms with their descriptions and marks the current one', async () => {
    renderWithProviders(
      <AllSectionsList nav={navWith()} organizationSlug="acme" onNavigate={vi.fn()} />,
    );
    const current = await screen.findByTestId('all-sections-today');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveTextContent('The clinic floor now');
    expect(screen.getByTestId('all-sections-leads')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Pin to keep in the bar')).toBeInTheDocument();
  });

  it('toggles a pin and names the action for each room', async () => {
    const user = userEvent.setup();
    const nav = navWith();
    renderWithProviders(
      <AllSectionsList nav={nav} organizationSlug="acme" onNavigate={vi.fn()} />,
    );
    const pinToday = await screen.findByRole('button', { name: 'Pin to bar · Today' });
    expect(pinToday).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.getByRole('button', { name: 'Unpin from bar · Leads' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await user.click(pinToday);
    expect(nav.togglePin).toHaveBeenCalledWith(today);
  });

  it('has no axe violations', async () => {
    const { container } = renderWithProviders(
      <AllSectionsList nav={navWith()} organizationSlug="acme" onNavigate={vi.fn()} />,
    );
    await screen.findByTestId('all-sections-today');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('AllSectionsSheet', () => {
  it('opens as a titled bottom sheet', async () => {
    renderWithProviders(
      <AllSectionsSheet
        nav={navWith()}
        organizationSlug="acme"
        open
        onOpenChange={vi.fn()}
      />,
    );
    const sheet = await screen.findByTestId('all-sections-sheet');
    expect(within(sheet).getByText('All sections')).toHaveClass('sr-only');
    expect(within(sheet).getByTestId('all-sections-leads')).toBeInTheDocument();
  });
});
