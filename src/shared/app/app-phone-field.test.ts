import { describe, expect, it } from 'vitest';

import {
  APP_PHONE_PREFIX,
  appPhoneDigits,
  appPhoneProblem,
  formatAppPhoneDigits,
  phoneDigitsOf,
  phoneIsInvalid,
  storedPhoneOf,
} from './app-phone-field.ts';

describe('a clinic mobile field', () => {
  it('keeps its ten digits, a pasted country code or trunk zero dropped', () => {
    expect(appPhoneDigits('98250 44120')).toBe('9825044120');
    expect(appPhoneDigits('+91 98250-44120')).toBe('9825044120');
    expect(appPhoneDigits('919825044120')).toBe('9825044120');
    expect(appPhoneDigits('098250 44120')).toBe('9825044120');
    // An eleventh digit typed on a mobile that starts with 91 keeps the ten.
    expect(appPhoneDigits('91987654321')).toBe('9198765432');
    expect(appPhoneDigits('98250441209')).toBe('9825044120');
    expect(appPhoneDigits('9125')).toBe('9125');
    expect(appPhoneDigits('abc')).toBe('');
  });

  it('spaces the digits as the design shows them, behind the +91 box', () => {
    expect(formatAppPhoneDigits('98250')).toBe('98250');
    expect(formatAppPhoneDigits('982504')).toBe('98250 4');
    expect(formatAppPhoneDigits('9825044120')).toBe('98250 44120');
    expect(APP_PHONE_PREFIX).toBe('+91');
  });

  it('reads a stored mobile into the field, and the field back into the contract', () => {
    expect(phoneDigitsOf('+919825044120')).toBe('9825044120');
    expect(phoneDigitsOf(null)).toBe('');
    expect(storedPhoneOf('9825044120')).toBe('+919825044120');
    expect(storedPhoneOf('')).toBeNull();
    expect(phoneIsInvalid('98250')).toBe(true);
    expect(phoneIsInvalid('')).toBe(false);
    expect(phoneIsInvalid('9825044120')).toBe(false);
  });

  it('says what is wrong with typed digits: too few, or a first digit no mobile has', () => {
    expect(appPhoneProblem('')).toBe('length');
    expect(appPhoneProblem('98250')).toBe('length');
    expect(appPhoneProblem('5555555555')).toBe('start');
    expect(appPhoneProblem('0123456789')).toBe('start');
    expect(appPhoneProblem('6000000000')).toBeNull();
    expect(appPhoneProblem('9825044120')).toBeNull();
  });
});
