import { describe, expect, it } from 'vitest';

import { estimatePasswordStrength } from './password-strength.ts';

describe('estimatePasswordStrength', () => {
  it('scores an empty password as 0 with no suggestion', () => {
    expect(estimatePasswordStrength('')).toEqual({
      score: 0,
      label: 'Very weak',
      suggestion: null,
    });
  });

  it('floors a known common password at 0 regardless of shape', () => {
    expect(estimatePasswordStrength('password123').score).toBe(0);
    expect(estimatePasswordStrength('Password123')?.score).toBe(0); // lowercased match
  });

  it('penalizes passwords that embed the user identity', () => {
    const r = estimatePasswordStrength('ada.lovelace2024!', ['ada.lovelace@acme.com']);
    expect(r.score).toBe(0);
    expect(r.suggestion).toMatch(/name or email/i);
  });

  it('penalizes trivial sequences and repeats', () => {
    expect(estimatePasswordStrength('abcabc').score).toBeLessThanOrEqual(1);
    expect(estimatePasswordStrength('aaaaaaaa').score).toBeLessThanOrEqual(1);
  });

  it('rewards length and character variety', () => {
    const weak = estimatePasswordStrength('short1');
    const strong = estimatePasswordStrength('Tr0ub4dour&3xplore!');
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.score).toBe(4);
    expect(strong.suggestion).toBeNull();
  });

  it('suggests more length for short-but-varied passwords', () => {
    expect(estimatePasswordStrength('aB3$xz').suggestion).toMatch(/12 or more/i);
  });

  it('always returns a label in range', () => {
    for (const pw of ['', 'a', 'abcdefgh', 'Abc12345', 'Abcd1234!xyzLMNO']) {
      const { score, label } = estimatePasswordStrength(pw);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(4);
      expect(label).toBeTruthy();
    }
  });
});
