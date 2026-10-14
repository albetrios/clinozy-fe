import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { SettingsSectionContext } from './settings-section-context.ts';
import { SectionHeader, SettingsSectionHeader } from './SettingsPanelShell.tsx';

const USER = { id: 'usr_1', email: 'u@e.com', role: 'user' } as AuthUser;

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
    // Settings is a drawer: its × floats outside the panel (inside its header on
    // a phone), so the head row keeps no corner clear for one.
    expect(header?.className ?? '').not.toMatch(/\bpe-14\b/);
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

  it('draws no tile outside Settings', () => {
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

describe('SettingsSectionHeader', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
    useOrganizationStore.getState().clearOrganization();
  });

  it.each([
    [
      'profile',
      'Profile',
      'How you appear in the app. Visible to people in your organization.',
    ],
    ['account', 'Account', 'Account metadata and irreversible actions.'],
    ['security', 'Security', 'Two-factor authentication and passkeys.'],
    ['notifications', 'Notifications', "Choose what you're notified about, and how."],
    ['sessions', 'Sessions', 'Devices currently signed in to your account.'],
    ['billing', 'Billing', 'Your plan, payment methods, and invoices.'],
    [
      'general',
      'Organization · General',
      'Identity for your organization across the platform.',
    ],
    ['members', 'Members', 'People in this organization.'],
    ['roles', 'Roles', 'Permission sets you can assign to members.'],
  ] as const)(
    'draws the %s section’s own title and sub line',
    (section, title, description) => {
      render(<SettingsSectionHeader section={section} />);
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
      expect(screen.getByText(description)).toBeInTheDocument();
    },
  );

  it('names webhooks in Integrations’ sub line only when the caller sees them', () => {
    useAuthStore.setState({ user: USER });
    const { rerender } = render(<SettingsSectionHeader section="integrations" />);
    expect(screen.getByRole('heading', { name: 'Integrations' })).toBeInTheDocument();
    expect(screen.getByText('API keys.')).toBeInTheDocument();

    act(() => {
      useOrganizationStore.setState({
        organizationType: 'TEAM',
        permissions: ['api-key:read', 'webhook:read'],
        permissionsResolved: true,
      });
    });
    rerender(<SettingsSectionHeader section="integrations" />);
    expect(screen.getByText('API keys and webhooks.')).toBeInTheDocument();
  });

  it('opens Profile on the signed-in profile’s completeness, and takes the live value over it', () => {
    useAuthStore.setState({ user: { ...USER, name: 'Riya Shah' } });
    const { rerender } = render(<SettingsSectionHeader section="profile" />);
    expect(screen.getByText('Profile 50% complete')).toBeInTheDocument();

    rerender(<SettingsSectionHeader section="profile" meta="Profile 100% complete" />);
    expect(screen.getByText('Profile 100% complete')).toBeInTheDocument();
    expect(screen.queryByText('Profile 50% complete')).not.toBeInTheDocument();
  });

  it('draws no meta for a section that has none', () => {
    render(<SettingsSectionHeader section="sessions" />);
    expect(screen.queryByText(/complete/)).not.toBeInTheDocument();
  });
});
