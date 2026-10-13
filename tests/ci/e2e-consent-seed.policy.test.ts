import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CONSENT_POLICY_VERSION,
  CONSENT_STORAGE_KEY,
} from '@/shared/store/useConsentStore/index.ts';

// The e2e suite's shared storage state pre-answers the consent card so it never sits over
// another spec's button. An answer to an older policy version counts as not answered (D161), so
// a policy bump without the seed would bring the card back over every spec.
describe('e2e consent seed', () => {
  const seed = JSON.parse(
    readFileSync(join(process.cwd(), 'tests/e2e/storage/e2e-init.json'), 'utf8'),
  ) as { origins: { localStorage: { name: string; value: string }[] }[] };

  it('answers the current consent policy, stamped at run start', () => {
    const entry = seed.origins
      .flatMap((origin) => origin.localStorage)
      .find((item) => item.name === CONSENT_STORAGE_KEY);
    expect(entry, `${CONSENT_STORAGE_KEY} is seeded`).toBeDefined();
    const stored = JSON.parse(entry?.value ?? '{}') as {
      state: { analyticsConsent: string; decidedAt: string; policyVersion: number };
    };
    expect(stored.state.policyVersion).toBe(CONSENT_POLICY_VERSION);
    expect(stored.state.analyticsConsent).toBe('denied');
    // playwright.config.ts replaces this with the run's start time.
    expect(stored.state.decidedAt).toBe('STAMPED_AT_RUN_START');
  });
});
