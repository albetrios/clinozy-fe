import { expect, it } from 'vitest';

import { selectOnlyEntries } from './sync-env-secrets.mjs';

// `pnpm github:sync --only KEY,KEY` pushes a few changed values without re-pushing every
// secret (GitHub can't diff secrets) — so it must push exactly the requested keys and refuse
// when one is missing or blank locally, rather than silently skipping it.
const declared = [
  { name: 'VITE_API_BASE_URL', value: 'https://api.example.test' },
  { name: 'SENTRY_AUTH_TOKEN', value: 'token' },
  { name: 'VITE_CSP_REPORT_URI', value: '' },
];

it('selectOnlyEntries selects exactly the requested keys', () => {
  const { entries, missing } = selectOnlyEntries(declared, ['VITE_API_BASE_URL']);
  expect(entries.map((entry) => entry.name)).toStrictEqual(['VITE_API_BASE_URL']);
  expect(missing).toStrictEqual([]);
});

it('selectOnlyEntries reports a requested key that is absent or blank locally', () => {
  expect(
    selectOnlyEntries(declared, ['VITE_API_BASE_URL', 'NOPE', 'VITE_CSP_REPORT_URI'])
      .missing,
  ).toStrictEqual(['NOPE', 'VITE_CSP_REPORT_URI']);
});
