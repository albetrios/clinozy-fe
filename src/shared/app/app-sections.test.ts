import { describe, expect, it } from 'vitest';

import { SECTION_VALUES } from '@/shared/api/app/app-schema.ts';

import {
  APP_SECTION_ORDER,
  appSectionForPath,
  appSectionLanding,
} from './app-sections.ts';

describe('APP_SECTION_ORDER', () => {
  it('lists every contract section once, Today first', () => {
    expect([...APP_SECTION_ORDER].sort()).toEqual([...SECTION_VALUES].sort());
    expect(APP_SECTION_ORDER[0]).toBe('today');
  });
});

describe('appSectionForPath', () => {
  it.each([
    ['/organization/acme/today', 'today'],
    ['/organization/acme/leads/9f1c/edit', 'leads'],
    ['/organization/acme/patients/1/timeline', 'patients'],
    ['/organization/acme/stock/items?category=x', 'stock'],
    ['/organization/acme/users/roles', 'users'],
  ])('%s → %s', (pathname, section) => {
    expect(appSectionForPath(pathname)).toBe(section);
  });

  it.each([
    '/organization/acme',
    '/organization/acme/dashboard',
    '/organization/acme/constructor',
    '/organization/acme/__proto__',
    '/dashboard',
    '/login',
  ])('%s is not a clinic room', (pathname) => {
    expect(appSectionForPath(pathname)).toBeNull();
  });
});

describe('appSectionLanding (Q-U11)', () => {
  const doctor = ['today', 'leads', 'appointments', 'patients', 'tasks'] as const;

  it('jumps a Doctor preview from Users to Leads', () => {
    expect(appSectionLanding('users', doctor)).toBe('leads');
  });

  it('stays on a room the access in force can view', () => {
    expect(appSectionLanding('patients', doctor)).toBeNull();
  });

  it('lands on Today when nothing else is viewable', () => {
    expect(appSectionLanding('payments', ['today'])).toBe('today');
  });

  it('leaves non-clinic pages alone', () => {
    expect(appSectionLanding(null, ['today'])).toBeNull();
  });
});
