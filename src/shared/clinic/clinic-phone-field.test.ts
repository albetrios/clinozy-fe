import { describe, expect, it } from 'vitest';

import {
  CLINIC_PHONE_PREFIX,
  clinicPhoneDigits,
  formatClinicPhoneDigits,
} from './clinic-phone-field.ts';

describe('a clinic mobile field', () => {
  it('keeps its ten digits, a pasted country code or trunk zero dropped', () => {
    expect(clinicPhoneDigits('98250 44120')).toBe('9825044120');
    expect(clinicPhoneDigits('+91 98250-44120')).toBe('9825044120');
    expect(clinicPhoneDigits('919825044120')).toBe('9825044120');
    expect(clinicPhoneDigits('098250 44120')).toBe('9825044120');
    // An eleventh digit typed on a mobile that starts with 91 keeps the ten.
    expect(clinicPhoneDigits('91987654321')).toBe('9198765432');
    expect(clinicPhoneDigits('98250441209')).toBe('9825044120');
    expect(clinicPhoneDigits('9125')).toBe('9125');
    expect(clinicPhoneDigits('abc')).toBe('');
  });

  it('spaces the digits as the design shows them, behind the +91 box', () => {
    expect(formatClinicPhoneDigits('98250')).toBe('98250');
    expect(formatClinicPhoneDigits('982504')).toBe('98250 4');
    expect(formatClinicPhoneDigits('9825044120')).toBe('98250 44120');
    expect(CLINIC_PHONE_PREFIX).toBe('+91');
  });
});
