import { describe, expect, it } from 'vitest';

import { TEAM_SORT_KEYS as CONTRACT_SORT_KEYS } from '@/shared/api/clinic/users-contracts.ts';

import {
  TEAM_SORT_KEYS,
  validateRolesSearch,
  validateUsersSearch,
} from './users.search.ts';

const ID = '7d3f5a8e-1b2c-4d5e-8f90-123456789abc';
/** A role's clinozy-be id — a preset's and a custom role's look alike. */
const ROLE = 'rol_abcdefghij0123456789k';

describe('validateUsersSearch', () => {
  it('keeps every value the Team can read', () => {
    expect(
      validateUsersSearch({
        q: '  #12 ',
        role: ROLE,
        branch: [ID],
        status: 'active,inactive',
        created: 'last_7',
        sort: 'name:desc',
      }),
    ).toEqual({
      q: '#12',
      role: ROLE,
      branch: [ID],
      status: ['active', 'inactive'],
      created: 'last_7',
      sort: 'name:desc',
    });
  });

  it('reads a role by its id — never a preset key or a stray value', () => {
    expect(validateUsersSearch({ role: ROLE }).role).toBe(ROLE);
    for (const role of ['front_desk', 'owner', 'rol_short']) {
      expect(validateUsersSearch({ role }).role).toBeUndefined();
    }
  });

  it('drops what the URL can’t hold — never an error', () => {
    expect(
      validateUsersSearch({
        q: '',
        branch: 'not-a-uuid',
        status: 'invited',
        created: 'someday',
        sort: 'branches:asc',
      }),
    ).toEqual({
      q: undefined,
      role: undefined,
      branch: undefined,
      status: undefined,
      created: undefined,
      sort: undefined,
    });
  });

  it('cuts a long search to 80 characters', () => {
    expect(validateUsersSearch({ q: 'x'.repeat(120) }).q).toHaveLength(80);
  });

  it('sorts by exactly the Team contract’s keys', () => {
    expect([...TEAM_SORT_KEYS]).toEqual([...CONTRACT_SORT_KEYS]);
  });
});

describe('validateRolesSearch', () => {
  it('keeps a role the page can show, by its id, and drops anything else', () => {
    expect(validateRolesSearch({ role: ROLE })).toEqual({ role: ROLE });
    expect(validateRolesSearch({ role: 'counsellor' })).toEqual({ role: undefined });
    expect(validateRolesSearch({})).toEqual({ role: undefined });
  });
});
