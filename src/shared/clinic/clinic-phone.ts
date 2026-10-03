/**
 * Phones and handles as the clinic shows and opens them. The contract stores an
 * Indian mobile as E.164 (`+919825044120`, `schema-routes.md` conventions) and
 * the design shows it as `+91 98250 44120` (KICKOFF §6.0 formats).
 */
const INDIAN_MOBILE = /^\+91([6-9]\d{4})(\d{5})$/;

/** `+919825044120` → `+91 98250 44120`; any other value is shown as given. */
export function formatClinicPhone(phone: string): string {
  const match = INDIAN_MOBILE.exec(phone);
  return match ? `+91 ${match[1]} ${match[2]}` : phone;
}

/** A `tel:` link for a stored phone. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** A WhatsApp chat link (`wa.me` takes the number with its country code, digits only). */
export function whatsAppHref(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

/** An Instagram profile link for a handle, with or without its "@". */
export function instagramHref(handle: string): string {
  return `https://instagram.com/${encodeURIComponent(handle.trim().replace(/^@/, ''))}`;
}
