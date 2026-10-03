/**
 * `.env.local` takes the external credentials `envProfiles.local.externalCredentials` names —
 * from `.env.development`, else the environment — filling only what is missing or blank.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  describeFilled,
  fillExternalCredentials,
  upsertEnvAssignment,
} from './external-credentials.ts';

const KEYS = ['VITE_STRIPE_PUBLISHABLE_KEY', 'VITE_POSTHOG_KEY', 'VITE_POSTHOG_HOST'];
const DEVELOPMENT = [
  'VITE_STRIPE_PUBLISHABLE_KEY=pk_test_dev',
  'VITE_POSTHOG_KEY=phc_dev',
  'VITE_POSTHOG_HOST=https://us.i.posthog.com',
  'VITE_API_BASE_URL=https://development--api.example.com',
  '',
].join('\n');

describe('fillExternalCredentials', () => {
  it('fills listed keys that are blank or missing locally, from .env.development', () => {
    const local = 'VITE_API_BASE_URL=\nVITE_STRIPE_PUBLISHABLE_KEY=\n';
    const { content, filled } = fillExternalCredentials(local, DEVELOPMENT, KEYS);
    assert.deepEqual(
      filled.map((entry) => entry.key),
      KEYS,
    );
    assert.ok(filled.every((entry) => entry.source === '.env.development'));
    assert.match(content, /^VITE_STRIPE_PUBLISHABLE_KEY=pk_test_dev$/m);
    assert.match(content, /^VITE_POSTHOG_HOST=https:\/\/us\.i\.posthog\.com$/m);
    assert.match(content, /^VITE_API_BASE_URL=$/m);
  });

  it('falls back to the environment when .env.development is absent or leaves a key out', () => {
    const environment = {
      VITE_POSTHOG_KEY: 'phc_cloud',
      VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_env',
    };
    const { content, filled } = fillExternalCredentials('', '', KEYS, environment);
    assert.deepEqual(filled, [
      { key: 'VITE_STRIPE_PUBLISHABLE_KEY', source: 'environment' },
      { key: 'VITE_POSTHOG_KEY', source: 'environment' },
    ]);
    assert.match(content, /^VITE_POSTHOG_KEY=phc_cloud$/m);
    // .env.development wins over the environment when it has the key.
    const both = fillExternalCredentials('', DEVELOPMENT, KEYS, environment);
    assert.match(both.content, /^VITE_POSTHOG_KEY=phc_dev$/m);
  });

  it('never overwrites a value already set locally', () => {
    const local = 'VITE_STRIPE_PUBLISHABLE_KEY=pk_test_mine\n';
    const { content, filled } = fillExternalCredentials(local, DEVELOPMENT, KEYS, {
      VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_env',
    });
    assert.deepEqual(
      filled.map((entry) => entry.key),
      ['VITE_POSTHOG_KEY', 'VITE_POSTHOG_HOST'],
    );
    assert.match(content, /^VITE_STRIPE_PUBLISHABLE_KEY=pk_test_mine$/m);
  });

  it('changes nothing when no source has the key', () => {
    const local = 'VITE_POSTHOG_KEY=\n';
    assert.deepEqual(fillExternalCredentials(local, 'VITE_POSTHOG_KEY=\n', KEYS, {}), {
      content: local,
      filled: [],
    });
  });

  it('describes what it filled by key name and source only', () => {
    assert.equal(
      describeFilled([
        { key: 'A', source: '.env.development' },
        { key: 'B', source: 'environment' },
      ]),
      'A (.env.development), B (environment)',
    );
  });
});

describe('upsertEnvAssignment', () => {
  it('replaces an existing line and appends a missing one', () => {
    assert.equal(upsertEnvAssignment('A=1\nB=2\n', 'A', 'x'), 'A=x\nB=2\n');
    assert.equal(upsertEnvAssignment('A=1', 'C', '3'), 'A=1\nC=3\n');
  });

  it('quotes a value that would not survive as a bare token, and keeps `$` literal', () => {
    assert.equal(upsertEnvAssignment('A=\n', 'A', 'a b'), 'A="a b"\n');
    assert.equal(upsertEnvAssignment('A=\n', 'A', 'p$1'), 'A="p$1"\n');
  });
});
