import { toAppPhone } from './app-phone.ts';

/**
 * A clinic mobile field as it is typed (the drawers' "+91" box, H:3761). Kept
 * apart from `app-phone.ts`, which the URL readers bring onto the entry
 * chunk: only the lazy drawers need these.
 */

/** The country code a clinic mobile field shows in its prefix box. */
export const APP_PHONE_PREFIX = '+91';

/** The ten digits a clinic mobile holds. */
const MOBILE_DIGITS = 10;

/**
 * What a mobile field keeps of typed or pasted text: its digits, at most ten.
 * A pasted `+91 98250-44120` (twelve digits from 91) loses the country code and
 * `098250 44120` its trunk zero; an eleventh digit typed on is dropped.
 */
export function appPhoneDigits(input: string): string {
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
export function formatAppPhoneDigits(digits: string): string {
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

/** A stored mobile as the "+91" field types it: its ten digits, or nothing. */
export const phoneDigitsOf = (phone: string | null): string =>
  phone ? appPhoneDigits(phone) : '';

/** The typed digits as the contract stores them (`+919825044120`); empty is none. */
export const storedPhoneOf = (digits: string): string | null =>
  digits ? toAppPhone(digits) : null;

/**
 * Why typed digits are not a mobile the clinic can store: `length` — not ten
 * digits; `start` — ten digits, but no Indian mobile starts with that digit
 * (only 6, 7, 8 and 9 do). `null` when they are one.
 */
export type AppPhoneProblem = 'length' | 'start';

/** What is wrong with typed mobile digits, so the message can say which (`null` = a mobile). */
export function appPhoneProblem(digits: string): AppPhoneProblem | null {
  if (digits.length !== MOBILE_DIGITS) return 'length';
  return toAppPhone(digits) === null ? 'start' : null;
}

/** Typed digits that are not a 10-digit Indian mobile ("Enter a 10-digit mobile"). */
export const phoneIsInvalid = (digits: string): boolean =>
  digits !== '' && toAppPhone(digits) === null;
