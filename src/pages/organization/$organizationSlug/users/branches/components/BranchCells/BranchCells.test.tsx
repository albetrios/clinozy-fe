import { screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import {
  branchAddressLine,
  branchDefaultsLines,
  BranchLinesCell,
  BranchNameCell,
  branchPhone,
  BranchStatusCell,
  BranchTeamCell,
} from './index.ts';

const ADAJAN = {
  name: 'Adajan',
  tone: 'sage',
  isMain: true,
  addressLine2: 'Near Star Bazaar, Adajan Gam Road',
  area: 'Adajan',
  city: 'Surat',
  pin: '395009',
  phone: '+917490020099',
} as unknown as Branch;

function teamMember(name: string, initials: string): TeamMember {
  return { membershipId: `mbr_${initials}`, name, initials, tone: 'lav' } as TeamMember;
}

describe('the Branches cells (users.md:85)', () => {
  it('shows the chip in the branch’s tone with "Main" on the main branch', async () => {
    const { container } = renderWithProviders(<BranchNameCell branch={ADAJAN} />);
    expect(await screen.findByText('Adajan')).toBeInTheDocument();
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads the address, the phone and the default people', () => {
    expect(branchAddressLine(ADAJAN)).toBe(
      'Near Star Bazaar, Adajan Gam Road, Adajan, Surat 395009',
    );
    expect(branchPhone(ADAJAN)).toBe('+91 74900 20099');
    expect(branchPhone({ ...ADAJAN, phone: '' })).toBe('—');
    const t = ((key: string, values?: { name: string }) =>
      `${key.split('.').at(-1) ?? ''} · ${values?.name ?? ''}`) as unknown as TFunction;
    expect(
      branchDefaultsLines(
        {
          defaults: [
            { role: 'doctor', member: teamMember('Dr. Nisha Mavani', 'NM') },
            { role: 'desk', member: teamMember('Riya Shah', 'RS') },
            { role: 'therapist', member: teamMember('Ridhi Sohaliya', 'RS') },
          ],
        },
        t,
      ),
    ).toEqual({
      value: 'doctor · Dr. Nisha Mavani',
      sub: 'desk · Riya Shah · therapist · Ridhi Sohaliya',
    });
    expect(branchDefaultsLines({ defaults: [] }, t)).toBeNull();
  });

  it('draws two lines, the first greyed when quiet', async () => {
    renderWithProviders(<BranchLinesCell value="Not set" quiet />);
    expect(await screen.findByText('Not set')).toHaveClass('text-muted-foreground');
  });

  it('shows up to four people, the first by short name, then "+N"', async () => {
    renderWithProviders(
      <BranchTeamCell
        team={[
          teamMember('Riya Shah', 'RS'),
          teamMember('Dr. Reenal Chaniyara', 'RC'),
          teamMember('Foram Kanpariya', 'FK'),
          teamMember('Dr. Drashti Moradiya', 'DM'),
          teamMember('Ridhi Sohaliya', 'RO'),
        ]}
      />,
    );
    expect(await screen.findByText('Riya S.')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('reads Open and Closed', async () => {
    const { unmount } = renderWithProviders(<BranchStatusCell active />);
    expect(await screen.findByText('Open')).toBeInTheDocument();
    unmount();
    renderWithProviders(<BranchStatusCell active={false} />);
    expect(await screen.findByText('Closed')).toBeInTheDocument();
  });
});
