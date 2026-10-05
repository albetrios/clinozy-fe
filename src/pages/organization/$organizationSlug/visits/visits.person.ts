import type { PatientConsent } from '@/shared/api/clinic/patients-contracts.ts';

const INDIAN_MOBILE = /^\+91(\d{5})(\d{3})(\d{2})$/;

/**
 * The sheet's masked number (`today.md:134`): "+91 98250 ··· 41" — the first
 * five digits and the last two of an Indian mobile; any other number keeps its
 * last two only.
 */
export function maskVisitPhone(phone: string): string {
  const match = INDIAN_MOBILE.exec(phone);
  if (match) return `+91 ${match[1]} ··· ${match[3]}`;
  const digits = phone.replace(/\D/g, '');
  return digits.length > 2 ? `··· ${digits.slice(-2)}` : phone;
}

/** The consents the chip names, in its order: data · photos · marketing. */
export const VISIT_CONSENTS = [
  'data',
  'photos',
  'marketing',
] as const satisfies readonly PatientConsent[];

/** "✓" for a consent given, "✗" for one not (text glyphs, `today.md:182`). */
export function consentMark(
  consents: readonly PatientConsent[],
  consent: PatientConsent,
): string {
  return consents.includes(consent) ? '✓' : '✗';
}
