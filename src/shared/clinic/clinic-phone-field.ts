/**
 * A clinic mobile field as it is typed (the drawers' "+91" box, H:3761). Kept
 * apart from `clinic-phone.ts`, which the URL readers bring onto the entry
 * chunk: only the lazy drawers need these.
 */

/** The country code a clinic mobile field shows in its prefix box. */
export const CLINIC_PHONE_PREFIX = '+91';

/** The ten digits a clinic mobile holds. */
const MOBILE_DIGITS = 10;

/**
 * What a mobile field keeps of typed or pasted text: its digits, at most ten.
 * A pasted `+91 98250-44120` (twelve digits from 91) loses the country code and
 * `098250 44120` its trunk zero; an eleventh digit typed on is dropped.
 */
export function clinicPhoneDigits(input: string): string {
  const digits = input.replace(/\D/g, '');
  let local = digits;
  if (digits.length === MOBILE_DIGITS + 2 && digits.startsWith('91')) {
    local = digits.slice(2);
  } else if (digits.length === MOBILE_DIGITS + 1 && digits.startsWith('0')) {
    local = digits.slice(1);
  }
  return local.slice(0, MOBILE_DIGITS);
}

/** A mobile field's digits as the design shows them while typing: `98250 44120`. */
export function formatClinicPhoneDigits(digits: string): string {
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}
