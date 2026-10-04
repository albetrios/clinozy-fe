import { describe, expect, it } from 'vitest';

import type { Role, Section } from '@/shared/api/clinic/clinic-schema.ts';

import { canUseVisitTab } from './visit-access.ts';

/** A member with these roles whose matrix grants exactly these section actions. */
const member = (roles: Role[], grants: string[] = []) => ({
  roles,
  can: (section: Section, action: string) => grants.includes(`${section}.${action}`),
});

describe('canUseVisitTab (KICKOFF §6.13 Access by tab)', () => {
  it('opens Consult & Rx to the doctor — and Admin and Owner', () => {
    expect(canUseVisitTab('consult', member(['doctor']))).toBe(true);
    expect(canUseVisitTab('consult', member(['admin']))).toBe(true);
    expect(canUseVisitTab('consult', member(['owner']))).toBe(true);
    expect(canUseVisitTab('consult', member(['therapist', 'front_desk']))).toBe(false);
  });

  it('opens Treatment to the doctor and the therapist', () => {
    expect(canUseVisitTab('treatment', member(['therapist']))).toBe(true);
    expect(canUseVisitTab('treatment', member(['doctor']))).toBe(true);
    expect(canUseVisitTab('treatment', member(['counsellor']))).toBe(false);
  });

  it('opens Checkout with Payments Create, and History with Patients View', () => {
    expect(canUseVisitTab('checkout', member(['accountant'], ['payments.create']))).toBe(
      true,
    );
    expect(canUseVisitTab('checkout', member(['doctor'], ['patients.view']))).toBe(false);
    expect(canUseVisitTab('timeline', member(['doctor'], ['patients.view']))).toBe(true);
    expect(canUseVisitTab('timeline', member(['pharmacist']))).toBe(false);
  });
});
