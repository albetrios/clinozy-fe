import { describe, expect, it } from 'vitest';

import { CLINIC_SECTION_ORDER } from '@/shared/clinic/clinic-sections.ts';

import {
  nextCustomRoleName,
  nextCustomRoleTone,
  resolveAccessFromCodes,
  SECTION_ACTION_CODES,
} from './access-api.ts';
import { CLINIC_ACTIONS } from './access-contracts.ts';

describe('resolveAccessFromCodes — every section from its codes', () => {
  it('opens Today to anyone, and nothing else without a code', () => {
    const access = resolveAccessFromCodes([]);
    expect(access.viewableSections).toEqual(['today']);
    expect(access.can('today', 'view')).toBe(true);
    expect(access.can('today', 'create')).toBe(false);
    expect(access.can('patients', 'view')).toBe(false);
  });

  it.each(
    Object.entries(SECTION_ACTION_CODES).flatMap(([section, codes]) =>
      CLINIC_ACTIONS.map((action) => [section, action, codes[action]] as const),
    ),
  )('%s · %s needs exactly %s', (section, action, code) => {
    expect(resolveAccessFromCodes([code]).can(section, action)).toBe(true);
    const others = Object.values(SECTION_ACTION_CODES)
      .flatMap((codes) => Object.values(codes))
      .filter((other) => other !== code);
    expect(resolveAccessFromCodes(others).can(section, action)).toBe(false);
  });

  it('lists the viewable sections in nav order', () => {
    const access = resolveAccessFromCodes([
      'payment:read',
      'lead:read',
      'organization:read',
      'membership:read',
    ]);
    expect(access.viewableSections).toEqual(
      CLINIC_SECTION_ORDER.filter((section) =>
        ['today', 'leads', 'payments', 'offerings', 'users'].includes(section),
      ),
    );
  });

  it('reads Offerings with organization:read (it has no read code of its own)', () => {
    expect(resolveAccessFromCodes(['organization:read']).can('offerings', 'view')).toBe(
      true,
    );
    expect(resolveAccessFromCodes(['offering:create']).can('offerings', 'view')).toBe(
      false,
    );
  });

  it('opens the Users room with membership:read alone — not the retired manage codes', () => {
    expect(resolveAccessFromCodes(['membership:read']).can('users', 'view')).toBe(true);
    const retired = resolveAccessFromCodes([
      'membership:manage',
      'invitation:manage',
      'role:manage',
    ]);
    expect(CLINIC_ACTIONS.some((action) => retired.can('users', action))).toBe(false);
  });
});

describe('a new custom role’s tone and name (H:5187)', () => {
  it('takes the next of plum · lime · mint · sky · peach · lav', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 13].map(nextCustomRoleTone)).toEqual([
      'plum',
      'lime',
      'mint',
      'sky',
      'peach',
      'lav',
      'plum',
      'lime',
    ]);
    expect(nextCustomRoleTone(-1)).toBe('plum');
  });

  it('is "New role", then "New role 2", "New role 3" … — the first free, any case', () => {
    expect(nextCustomRoleName('New role', ['Admin', 'Doctor'])).toBe('New role');
    expect(nextCustomRoleName('New role', ['new role'])).toBe('New role 2');
    expect(nextCustomRoleName('New role', ['New role', 'New Role 2', 'Front desk'])).toBe(
      'New role 3',
    );
  });
});
