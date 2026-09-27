/**
 * Smart defaults that make first-run setup faster. Pure functions — no React,
 * no store; used by the onboarding workspace step to prefill fields.
 */

/** Free/personal mail domains we never turn into an organization name. */
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'gmx.com',
  'mail.com',
  'zoho.com',
]);

/**
 * Derive a likely organization name from a work email's domain
 * (`ada@acme-corp.com` → `"Acme Corp"`). Returns `null` for personal-mail
 * domains, malformed input, or anything that yields nothing useful — the
 * caller leaves the field empty in that case rather than guessing wrong.
 */
export function organizationNameFromEmail(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1) return null;

  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  if (!domain.includes('.') || PERSONAL_EMAIL_DOMAINS.has(domain)) return null;

  // Drop the public-suffix-ish tail; keep the registrable label.
  const label = domain.split('.')[0] ?? '';
  const words = label.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return null;

  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
