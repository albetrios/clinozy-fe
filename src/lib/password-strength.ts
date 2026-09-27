/**
 * Dependency-free password-strength heuristic. Deliberately NOT zxcvbn: a
 * dictionary estimator would be a heavy lazy chunk on the auth pages, against
 * this repo's bundle discipline. This is a compact, well-tested signal for the
 * UI meter — the authoritative breach check is {@link checkPasswordBreached}
 * (see `password-breach.ts`) and the backend enforces the real policy.
 */

export type PasswordScore = 0 | 1 | 2 | 3 | 4;

/** Outcome of a password-strength estimate: a 0–4 score, label, and one tip. */
export interface PasswordStrength {
  score: PasswordScore;
  label: 'Very weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  /** A single most-impactful improvement, or `null` when already strong. */
  suggestion: string | null;
}

const LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'] as const;

/** A small blocklist of the most-abused passwords (lowercased). */
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'qwerty123',
  'azerty',
  'letmein',
  'welcome',
  'welcome1',
  'admin',
  'administrator',
  'iloveyou',
  'monkey',
  'dragon',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'superman',
  'trustno1',
  'passw0rd',
  'changeme',
  'abc123',
  'starwars',
]);

/** Detect a run of 3+ sequential or repeated characters (`abc`, `321`, `aaa`). */
function hasTrivialRun(value: string): boolean {
  for (let i = 0; i + 2 < value.length; i += 1) {
    const a = value.charCodeAt(i);
    const b = value.charCodeAt(i + 1);
    const c = value.charCodeAt(i + 2);
    if (a === b && b === c) return true; // repeat
    if (b - a === 1 && c - b === 1) return true; // ascending
    if (a - b === 1 && b - c === 1) return true; // descending
  }
  return false;
}

function characterClasses(password: string): number {
  return [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((re) => re.test(password))
    .length;
}

function result(score: PasswordScore, suggestion: string | null): PasswordStrength {
  // `.at()` (not LABELS[score]) keeps the static object-injection lint quiet;
  // score is always 0–4 so the fallback is unreachable.
  return { score, label: LABELS.at(score) ?? 'Very weak', suggestion };
}

/**
 * Estimate password strength on a 0–4 scale.
 *
 * @param password - The candidate password.
 * @param userInputs - Personal strings to penalize if embedded (e.g. the
 *   user's email or name) — a password containing them is trivially guessable.
 */
export function estimatePasswordStrength(
  password: string,
  userInputs: readonly string[] = [],
): PasswordStrength {
  if (!password) return result(0, null);

  const lower = password.toLowerCase();

  if (COMMON_PASSWORDS.has(lower)) {
    return result(0, 'This is a commonly used password — pick something unique.');
  }
  // Tokenize identity inputs (an email → ['ada', 'lovelace', 'acme', …]) so a
  // password embedding any meaningful 4+ char piece is penalized, not just the
  // whole verbatim string.
  const identityTokens = userInputs
    .flatMap((input) => input.toLowerCase().split(/[^a-z0-9]+/))
    .filter((token) => token.length >= 4);
  if (identityTokens.some((token) => lower.includes(token))) {
    return result(0, 'Avoid using your name or email in your password.');
  }

  let credits = 0;
  if (password.length >= 8) credits += 1;
  if (password.length >= 12) credits += 1;
  if (password.length >= 16) credits += 1;

  const classes = characterClasses(password);
  if (classes >= 2) credits += 1;
  if (classes >= 3) credits += 1;

  if (hasTrivialRun(lower)) credits -= 2;
  if (password.length < 8) credits = Math.min(credits, 1);

  const score = Math.max(0, Math.min(4, credits)) as PasswordScore;

  let suggestion: string | null = null;
  if (password.length < 12) suggestion = 'Use 12 or more characters.';
  else if (classes < 3) suggestion = 'Mix in uppercase, numbers, and symbols.';

  return result(score, suggestion);
}
