import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { SettingsSectionContext } from './settings-section-context.ts';
import { SectionHeader } from './SettingsPanelShell.tsx';

describe('SectionHeader', () => {
  it('renders title, description, and meta', () => {
    render(<SectionHeader title="Profile" description="Your details" meta="80%" />);
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByText('Your details')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  // The breadcrumb is gone. It repeated what the nav rail (and, on a phone, the
  // section picker) already said, and only 3 of the ~10 panels ever passed one —
  // so it was inconsistent as well as redundant. The title is the panel's heading
  // at every width and is not conditional.
  it('renders the title with no scope line above it', () => {
    render(<SectionHeader title="Profile" />);
    expect(screen.getByRole('heading', { name: 'Profile' })).not.toHaveClass('hidden');
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it('is the pane’s pinned, hairline-edged head row in the drawer title’s type', () => {
    render(<SectionHeader title="Profile" />);
    const heading = screen.getByRole('heading', { name: 'Profile' });
    expect(heading).toHaveClass('text-lg', 'font-semibold', 'tracking-[-0.01em]');
    const header = heading.closest('header');
    expect(header).toHaveClass('sticky', 'top-0', 'border-b', 'bg-background');
    // From `sm` it keeps the dialog's close button's corner clear.
    expect(header).toHaveClass('sm:pe-14');
  });

  it('draws the section’s icon on a tile in its scope’s tone', () => {
    const { rerender } = render(
      <SettingsSectionContext value={{ scope: 'account', section: 'security' }}>
        <SectionHeader title="Security" />
      </SettingsSectionContext>,
    );
    const tile = screen.getByTestId('settings-section-tile');
    expect(tile).toHaveClass('size-10', 'rounded-xl', 'bg-tone-stone');
    expect(tile.querySelector('svg')).not.toBeNull();

    rerender(
      <SettingsSectionContext value={{ scope: 'organization', section: 'general' }}>
        <SectionHeader title="General" />
      </SettingsSectionContext>,
    );
    expect(screen.getByTestId('settings-section-tile')).toHaveClass('bg-tone-slate');
  });

  it('draws no tile outside the modal', () => {
    render(<SectionHeader title="Profile" />);
    expect(screen.queryByTestId('settings-section-tile')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <SettingsSectionContext value={{ scope: 'account', section: 'profile' }}>
        <SectionHeader title="Profile" description="Your details" meta="80% complete" />
      </SettingsSectionContext>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
