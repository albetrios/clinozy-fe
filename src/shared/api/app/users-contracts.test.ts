import { describe, expect, it } from 'vitest';

import { staffInitials, TEAM_SORT_KEYS } from './users-contracts.ts';

describe('the Team’s initials (usIni, H:3607)', () => {
  it.each<[string, string]>([
    ['Riya Shah', 'RS'],
    ['Dr. Reenal Chaniyara', 'RC'],
    ['Dr Drashti Moradiya', 'DM'],
    ['Admin Cresence Skin', 'AS'],
    ['nidhi', 'N'],
    ['Drishti Patel', 'DP'],
    // An invitee shows their email until they set a name.
    ['k.mehta@clinic.com', 'K'],
  ])('makes "%s" %s', (name, initials) => {
    expect(staffInitials(name)).toBe(initials);
  });
});

describe('the Team’s sorts (H:5150)', () => {
  it('sorts by ID, User, Email, Roles, Commission, Status and Updated — never Branches or hours', () => {
    expect([...TEAM_SORT_KEYS]).toEqual([
      'seq',
      'name',
      'email',
      'role',
      'commission',
      'status',
      'updatedAt',
    ]);
  });
});
