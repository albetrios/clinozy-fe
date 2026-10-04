import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import {
  TeamIdCell,
  TeamRolesCell,
  TeamStatusCell,
  TeamTextCell,
  TeamUserCell,
} from './index.ts';

/** A Team row with the fields the cells read. */
function teamMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    membershipId: 'mbr_reenal',
    userId: 'usr_reenal',
    email: 'reenal@cresence.skin',
    status: 'active',
    invitation: null,
    platformRoleId: 'rol_member',
    platformRoleName: 'Member',
    joinedAt: '2026-09-01T10:00:00.000Z',
    isOwner: false,
    isSelf: false,
    name: 'Dr. Reenal Chaniyara',
    initials: 'RC',
    tone: 'lav',
    roleKeys: ['doctor'],
    seq: 11,
    phone: '+919328790051',
    branchIds: [],
    presence: 'away',
    lastActiveAt: null,
    profile: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T04:30:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('the Team cells (users.md:32)', () => {
  it('shows the #ID pill, or nothing without a profile', async () => {
    const { unmount } = renderWithProviders(<TeamIdCell label="#12" />);
    expect(await screen.findByText('#12')).toBeInTheDocument();
    unmount();
    const { container, router } = renderWithProviders(<TeamIdCell label={null} />);
    await router.load();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the person with their initials and mobile — no hover card', async () => {
    renderWithProviders(<TeamUserCell member={teamMember()} />);
    expect(await screen.findByText('Dr. Reenal Chaniyara')).toBeInTheDocument();
    expect(screen.getByText('+91 93287 90051')).toBeInTheDocument();
    expect(screen.getByText('RC')).toBeInTheDocument();
  });

  it('draws each role in its tone, the main role first', async () => {
    renderWithProviders(
      <TeamRolesCell
        roles={[
          { id: 'front_desk', label: 'Front desk', tone: 'mint' },
          { id: 'admin', label: 'Admin', tone: 'lav' },
        ]}
      />,
    );
    const pills = await screen.findAllByText(/Front desk|Admin/);
    expect(pills.map((pill) => pill.textContent)).toEqual(['Front desk', 'Admin']);
    expect(pills[0]?.closest('[data-tone]')).toHaveAttribute('data-tone', 'mint');
  });

  it('reads Active, Inactive and Invited — the invitation with its expiry', async () => {
    const { rerender } = renderWithProviders(<TeamStatusCell member={teamMember()} />);
    expect(await screen.findByText('Active')).toBeInTheDocument();
    rerender(<TeamStatusCell member={teamMember({ status: 'suspended' })} />);
    expect(await screen.findByText('Inactive')).toBeInTheDocument();
    rerender(
      <TeamStatusCell
        member={teamMember({
          status: 'invited',
          invitation: { id: 'inv_1', expiresAt: '2026-10-10T04:30:00.000Z' },
        })}
      />,
    );
    expect(await screen.findByText('Invited')).toBeInTheDocument();
    expect(screen.getByText(/^Invitation expires /)).toBeInTheDocument();
    rerender(
      <TeamStatusCell
        member={teamMember({
          status: 'invited',
          invitation: { id: 'inv_1', expiresAt: '2026-10-01T04:30:00.000Z' },
        })}
      />,
    );
    expect(await screen.findByText('Invitation expired')).toBeInTheDocument();
  });

  it('shows "—" for an empty text cell', async () => {
    renderWithProviders(<TeamTextCell value={null} />);
    expect(await screen.findByText('—')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderWithProviders(
      <div>
        <TeamUserCell member={teamMember()} />
        <TeamStatusCell member={teamMember()} />
      </div>,
    );
    await screen.findByText('Active');
    expect(await axe(container)).toHaveNoViolations();
  });
});
