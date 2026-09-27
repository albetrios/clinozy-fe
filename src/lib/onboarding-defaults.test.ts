import { describe, expect, it } from 'vitest';

import { organizationNameFromEmail } from './onboarding-defaults.ts';

describe('organizationNameFromEmail', () => {
  it('humanizes a work-email domain', () => {
    expect(organizationNameFromEmail('ada@acme.com')).toBe('Acme');
    expect(organizationNameFromEmail('ada@acme-corp.io')).toBe('Acme Corp');
  });

  it('returns null for personal-mail domains', () => {
    expect(organizationNameFromEmail('ada@gmail.com')).toBeNull();
    expect(organizationNameFromEmail('ada@icloud.com')).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(organizationNameFromEmail('not-an-email')).toBeNull();
    expect(organizationNameFromEmail('@acme.com')).toBeNull();
    expect(organizationNameFromEmail('ada@')).toBeNull();
    expect(organizationNameFromEmail('ada@localhost')).toBeNull();
  });
});
