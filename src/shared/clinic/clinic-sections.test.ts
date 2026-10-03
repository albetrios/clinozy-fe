import { describe, expect, it } from 'vitest';

import { SECTION_VALUES } from '@/shared/api/clinic/clinic-schema.ts';

import {
  CLINIC_SECTION_ORDER,
  clinicSectionForPath,
  clinicSectionLanding,
} from './clinic-sections.ts';

describe('CLINIC_SECTION_ORDER', () => {
  it('lists every contract section once, Today first', () => {
    expect([...CLINIC_SECTION_ORDER].sort()).toEqual([...SECTION_VALUES].sort());
    expect(CLINIC_SECTION_ORDER[0]).toBe('today');
  });
});

describe('clinicSectionForPath', () => {
  it.each([
    ['/organization/acme/today', 'today'],
    ['/organization/acme/visits/0b6d…', 'today'],
    ['/organization/acme/leads/9f1c/edit', 'leads'],
    ['/organization/acme/patients/1/timeline', 'patients'],
    ['/organization/acme/stock/items?category=x', 'stock'],
    ['/organization/acme/users/roles', 'users'],
  ])('%s → %s', (pathname, section) => {
    expect(clinicSectionForPath(pathname)).toBe(section);
  });

  it.each([
    '/organization/acme',
    '/organization/acme/dashboard',
    '/organization/acme/constructor',
    '/organization/acme/__proto__',
    '/dashboard',
    '/login',
  ])('%s is not a clinic room', (pathname) => {
    expect(clinicSectionForPath(pathname)).toBeNull();
  });
});

describe('clinicSectionLanding (Q-U11)', () => {
  const doctor = ['today', 'leads', 'appointments', 'patients', 'tasks'] as const;

  it('jumps a Doctor preview from Users to Leads', () => {
    expect(clinicSectionLanding('users', doctor)).toBe('leads');
  });

  it('stays on a room the access in force can view', () => {
    expect(clinicSectionLanding('patients', doctor)).toBeNull();
  });

  it('lands on Today when nothing else is viewable', () => {
    expect(clinicSectionLanding('payments', ['today'])).toBe('today');
  });

  it('leaves non-clinic pages alone', () => {
    expect(clinicSectionLanding(null, ['today'])).toBeNull();
  });
});
