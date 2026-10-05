/**
 * Phones and handles as the clinic shows and opens them. The contract stores an
 * Indian mobile as E.164 (`+919825044120`, `schema-routes.md` conventions) and
 * the design shows it as `+91 98250 44120` (KICKOFF §6.0 formats).
 */
const INDIAN_MOBILE = /^\+91([6-9]\d{4})(\d{5})$/;
const TYPED_MOBILE = /^(?:91)?([6-9]\d{9})$/;

/**
 * A typed or pasted mobile as the contract stores it: `98250 44120`,
 * `+91 98250-44120` or `919825044120` → `+919825044120` (a pasted 91 stripped);
 * `null` for anything that is not a 10-digit Indian mobile.
 */
export function toClinicPhone(input: string | number): string | null {
  const digits = String(input).replace(/[\s()+-]/g, '');
  const match = TYPED_MOBILE.exec(digits);
  return match ? `+91${match[1]}` : null;
}

/** `+919825044120` → `+91 98250 44120`; any other value is shown as given. */
export function formatClinicPhone(phone: string): string {
  const match = INDIAN_MOBILE.exec(phone);
  return match ? `+91 ${match[1]} ${match[2]}` : phone;
}

/** A `tel:` link for a stored phone. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/**
 * A WhatsApp chat link (`wa.me` takes the number with its country code, digits
 * only); with `text`, the chat opens with that message typed, ready to send.
 */
export function whatsAppHref(phone: string, text?: string): string {
  const chat = `https://wa.me/${phone.replace(/\D/g, '')}`;
  return text ? `${chat}?text=${encodeURIComponent(text)}` : chat;
}

/** An Instagram profile link for a handle, with or without its "@". */
export function instagramHref(handle: string): string {
  return `https://instagram.com/${encodeURIComponent(handle.trim().replace(/^@/, ''))}`;
}
