import { describe, expect, it } from 'vitest';

import { consentMark, maskVisitPhone } from './visits.person.ts';

describe('the header band’s person (`today.md:134`)', () => {
  it('masks an Indian mobile as "+91 98250 ··· 41"', () => {
    expect(maskVisitPhone('+919825011241')).toBe('+91 98250 ··· 41');
  });

  it('keeps only the last two digits of any other number, or what is too short to mask', () => {
    expect(maskVisitPhone('+14155550123')).toBe('··· 23');
    expect(maskVisitPhone('12')).toBe('12');
  });

  it('marks each consent ✓ or ✗', () => {
    expect(consentMark(['data', 'photos'], 'photos')).toBe('✓');
    expect(consentMark(['data'], 'marketing')).toBe('✗');
  });
});
