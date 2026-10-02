import assert from 'node:assert/strict';
import test from 'node:test';

import { selectOnlyEntries } from './sync-env-secrets.mjs';

// `pnpm github:sync --only KEY,KEY` pushes a few changed values without re-pushing every
// secret (GitHub can't diff secrets) — so it must push exactly the requested keys and refuse
// when one is missing or blank locally, rather than silently skipping it.
const declared = [
  { name: 'VITE_API_BASE_URL', value: 'https://api.example.test' },
  { name: 'SENTRY_AUTH_TOKEN', value: 'token' },
  { name: 'VITE_CSP_REPORT_URI', value: '' },
];

test('selectOnlyEntries selects exactly the requested keys', () => {
  const { entries, missing } = selectOnlyEntries(declared, ['VITE_API_BASE_URL']);
  assert.deepEqual(
    entries.map((entry) => entry.name),
    ['VITE_API_BASE_URL'],
  );
  assert.deepEqual(missing, []);
});

test('selectOnlyEntries reports a requested key that is absent or blank locally', () => {
  assert.deepEqual(
    selectOnlyEntries(declared, ['VITE_API_BASE_URL', 'NOPE', 'VITE_CSP_REPORT_URI'])
      .missing,
    ['NOPE', 'VITE_CSP_REPORT_URI'],
  );
});
