/**
 * `.env.local` takes the external credentials `envProfiles.local.externalCredentials` names —
 * from `.env.development`, else the environment — filling only what is missing or blank.
 */
import { describe, expect, it } from 'vitest';

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
    expect(filled.map((entry) => entry.key)).toStrictEqual(KEYS);
    expect(filled.every((entry) => entry.source === '.env.development')).toBeTruthy();
    expect(content).toMatch(/^VITE_STRIPE_PUBLISHABLE_KEY=pk_test_dev$/m);
    expect(content).toMatch(/^VITE_POSTHOG_HOST=https:\/\/us\.i\.posthog\.com$/m);
    expect(content).toMatch(/^VITE_API_BASE_URL=$/m);
  });

  it('falls back to the environment when .env.development is absent or leaves a key out', () => {
    const environment = {
      VITE_POSTHOG_KEY: 'phc_cloud',
      VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_env',
    };
    const { content, filled, missing } = fillExternalCredentials(
      '',
      '',
      KEYS,
      environment,
    );
    expect(filled).toStrictEqual([
      { key: 'VITE_STRIPE_PUBLISHABLE_KEY', source: 'environment' },
      { key: 'VITE_POSTHOG_KEY', source: 'environment' },
    ]);
    expect(missing).toStrictEqual(['VITE_POSTHOG_HOST']);
    expect(content).toMatch(/^VITE_POSTHOG_KEY=phc_cloud$/m);
    // .env.development wins over the environment when it has the key.
    const both = fillExternalCredentials('', DEVELOPMENT, KEYS, environment);
    expect(both.content).toMatch(/^VITE_POSTHOG_KEY=phc_dev$/m);
  });

  it('never overwrites a value already set locally', () => {
    const local = 'VITE_STRIPE_PUBLISHABLE_KEY=pk_test_mine\n';
    const { content, filled } = fillExternalCredentials(local, DEVELOPMENT, KEYS, {
      VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_env',
    });
    expect(filled.map((entry) => entry.key)).toStrictEqual([
      'VITE_POSTHOG_KEY',
      'VITE_POSTHOG_HOST',
    ]);
    expect(content).toMatch(/^VITE_STRIPE_PUBLISHABLE_KEY=pk_test_mine$/m);
  });

  it('changes nothing and reports the key missing when no source has it', () => {
    const local = 'VITE_POSTHOG_KEY=\n';
    expect(fillExternalCredentials(local, 'VITE_POSTHOG_KEY=\n', KEYS, {})).toStrictEqual(
      {
        content: local,
        filled: [],
        missing: KEYS,
      },
    );
  });

  it('reports nothing missing once every key is set locally', () => {
    const local = DEVELOPMENT;
    expect(fillExternalCredentials(local, '', KEYS, {})).toStrictEqual({
      content: local,
      filled: [],
      missing: [],
    });
  });

  it('describes what it filled by key name and source only', () => {
    expect(
      describeFilled([
        { key: 'A', source: '.env.development' },
        { key: 'B', source: 'environment' },
      ]),
    ).toBe('A (.env.development), B (environment)');
  });
});

describe('upsertEnvAssignment', () => {
  it('replaces an existing line and appends a missing one', () => {
    expect(upsertEnvAssignment('A=1\nB=2\n', 'A', 'x')).toBe('A=x\nB=2\n');
    expect(upsertEnvAssignment('A=1', 'C', '3')).toBe('A=1\nC=3\n');
  });

  it('quotes a value that would not survive as a bare token, and keeps `$` literal', () => {
    expect(upsertEnvAssignment('A=\n', 'A', 'a b')).toBe('A="a b"\n');
    expect(upsertEnvAssignment('A=\n', 'A', 'p$1')).toBe('A="p$1"\n');
  });
});
