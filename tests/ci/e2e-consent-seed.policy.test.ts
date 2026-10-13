import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CONSENT_COOKIE_NAME,
  CONSENT_POLICY_VERSION,
} from '@/shared/store/useConsentStore/index.ts';

// The e2e suite's shared storage state pre-answers the cookie card (in the consent cookie) so it
// never sits over another spec's button. An answer to another policy version counts as not
// answered, so a policy bump without the seed would bring the card back over every spec.
describe('e2e consent seed', () => {
  const seed = JSON.parse(
    readFileSync(join(process.cwd(), 'tests/e2e/storage/e2e-init.json'), 'utf8'),
  ) as { cookies: { name: string; value: string; path: string; sameSite: string }[] };

  it('answers the current consent policy with Reject all, in the consent cookie', () => {
    const cookie = seed.cookies.find((item) => item.name === CONSENT_COOKIE_NAME);
    expect(cookie, `${CONSENT_COOKIE_NAME} is seeded`).toBeDefined();
    expect(cookie).toMatchObject({ path: '/', sameSite: 'Lax' });
    const stored = JSON.parse(decodeURIComponent(cookie?.value ?? '{}')) as {
      analytics: boolean;
      version: number;
      decidedAt: string;
    };
    expect(stored.version).toBe(CONSENT_POLICY_VERSION);
    expect(stored.analytics).toBe(false);
    expect(Number.isNaN(Date.parse(stored.decidedAt))).toBe(false);
  });
});
