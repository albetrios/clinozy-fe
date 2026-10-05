import { describe, expect, it } from 'vitest';

import { CLINIC_ROLE_CATALOG } from '@/shared/api/clinic/access-contracts.ts';
import { TEAM_SORT_KEYS as CONTRACT_SORT_KEYS } from '@/shared/api/clinic/users-contracts.ts';

import {
  TEAM_SORT_KEYS,
  validateRolesSearch,
  validateUsersSearch,
} from './users.search.ts';

const ID = '7d3f5a8e-1b2c-4d5e-8f90-123456789abc';

describe('validateUsersSearch', () => {
  it('keeps every value the Team can read', () => {
    expect(
      validateUsersSearch({
        q: '  #12 ',
        role: 'front_desk',
        branch: [ID],
        status: 'active,inactive',
        created: 'last_7',
        sort: 'name:desc',
      }),
    ).toEqual({
      q: '#12',
      role: 'front_desk',
      branch: [ID],
      status: ['active', 'inactive'],
      created: 'last_7',
      sort: 'name:desc',
    });
  });

  it('reads every catalog role and a custom role’s id, never Owner or a stray value', () => {
    for (const role of CLINIC_ROLE_CATALOG) {
      expect(validateUsersSearch({ role }).role).toBe(role);
    }
    expect(validateUsersSearch({ role: 'rol_abcdefghij0123456789k' }).role).toBe(
      'rol_abcdefghij0123456789k',
    );
    expect(validateUsersSearch({ role: 'owner' }).role).toBeUndefined();
    expect(validateUsersSearch({ role: 'rol_short' }).role).toBeUndefined();
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
  it('keeps a role the page can show and drops anything else', () => {
    expect(validateRolesSearch({ role: 'counsellor' })).toEqual({ role: 'counsellor' });
    expect(validateRolesSearch({ role: 'rol_abcdefghij0123456789k' })).toEqual({
      role: 'rol_abcdefghij0123456789k',
    });
    expect(validateRolesSearch({ role: 'owner' })).toEqual({ role: undefined });
    expect(validateRolesSearch({})).toEqual({ role: undefined });
  });
});
