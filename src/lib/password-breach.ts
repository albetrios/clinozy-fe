/**
 * Have I Been Pwned password check via k-anonymity. The password never leaves
 * the browser: we SHA-1 it locally and send only the first 5 hex chars of the
 * hash to the range API, then match the suffix against the returned list. The
 * `Add-Padding` header makes HIBP pad the response so its size can't leak which
 * prefix was queried.
 *
 * Best-effort by contract: any failure (offline, blocked, unsupported crypto)
 * resolves to `null`, never throws — a breach check that can't run must not
 * block the user (the strength meter and the backend remain in force).
 *
 * connect-src: `https://api.pwnedpasswords.com` is allowlisted in the CSP
 * (`lib/csp-api-origin.ts` + `index.html` meta).
 */

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

/** Outcome of a Have I Been Pwned password lookup. */
export interface BreachResult {
  /** True when the password appears in at least one known breach. */
  breached: boolean;
  /** How many times it was seen across breaches (0 when not found). */
  count: number;
}

async function sha1HexUpper(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  // SHA-1 is mandated by the HIBP range API protocol; the privacy guarantee is
  // k-anonymity (only a 5-char prefix is sent), not the hash's strength.
  // eslint-disable-next-line sonarjs/hashing -- protocol-required, not a security primitive
  const digest = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Check a password against Have I Been Pwned via k-anonymity.
 *
 * @returns breach info, or `null` when the check could not be performed.
 */
export async function checkPasswordBreached(
  password: string,
): Promise<BreachResult | null> {
  if (!password) return null;
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;

  try {
    const hash = await sha1HexUpper(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!response.ok) return null;

    const body = await response.text();
    for (const line of body.split('\n')) {
      const [lineSuffix, countStr] = line.trim().split(':');
      if (lineSuffix === suffix) {
        const count = Number.parseInt(countStr ?? '0', 10) || 0;
        return { breached: count > 0, count };
      }
    }
    return { breached: false, count: 0 };
  } catch {
    return null;
  }
}
