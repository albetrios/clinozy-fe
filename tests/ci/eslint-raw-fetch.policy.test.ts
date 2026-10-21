import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ESLint, type Linter } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// Locks the raw-fetch guard in `eslint.config.mjs` against the REAL config —
// wiring (which files it reaches), behaviour (what it flags) and the allowlist.
//
// API calls go through `apiClient`, which attaches the access token, refreshes it
// once on a 401, retries and maps errors. A raw `fetch()` skips all of it. Flat
// config REPLACES a rule's options rather than merging them, so a later block that
// declares `no-restricted-globals` or `no-restricted-properties` for `src` would
// silently remove this guard; these tests are what would notice.
const RULES = new Set(['no-restricted-globals', 'no-restricted-properties']);
const MESSAGE = 'Call the API through apiClient';

let eslint: ESLint;
let config: Linter.Config[];

beforeAll(async () => {
  eslint = new ESLint({ cwd: process.cwd() });
  // Loaded by URL: the config is plain JavaScript with no type declaration.
  const configUrl = pathToFileURL(join(process.cwd(), 'eslint.config.mjs')).href;
  config = ((await import(configUrl)) as { default: Linter.Config[] }).default;
});

/** Messages from the guard under test only — other rules have opinions too. */
async function restricted(source: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(source, { filePath });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId !== null && RULES.has(message.ruleId))
    .map((message) => message.message);
}

/** The files the guard exempts, read from the block that declares it. */
function allowlist(): string[] {
  const block = config.find(
    (entry) => entry.rules?.['no-restricted-globals'] !== undefined,
  );
  return (block?.ignores ?? []).filter((pattern) => !pattern.includes('*'));
}

describe('API calls go through apiClient, never a raw fetch (src)', () => {
  const FILE = 'src/pages/organization/Probe/ProbePage.tsx';

  it.each([
    ['fetch()', "export const probe = () => fetch('/api/v1/patients');"],
    ['window.fetch()', "export const probe = () => window.fetch('/api/v1/patients');"],
    [
      'globalThis.fetch()',
      "export const probe = () => globalThis.fetch('/api/v1/patients');",
    ],
  ])('flags a raw %s in app source', async (_label, source) => {
    const messages = await restricted(source, FILE);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain(MESSAGE);
  });

  it.each([
    [
      'a TanStack Query refetch',
      'declare const query: { refetch: () => void };\nquery.refetch();\nexport {};',
    ],
    ['a local named fetch', 'const fetch = () => 1;\nexport const probe = fetch();'],
  ])('allows %s', async (_label, source) => {
    expect(await restricted(source, FILE)).toEqual([]);
  });

  it('leaves colocated tests alone — they stub fetch', async () => {
    const source = "export const probe = () => fetch('/api/v1/patients');";

    expect(
      await restricted(source, 'src/pages/organization/Probe/ProbePage.test.tsx'),
    ).toEqual([]);
  });

  it('exempts only files that still call fetch themselves', () => {
    // A file that stops calling fetch leaves the allowlist; a new raw caller has
    // to make its case in review instead of joining a list nobody re-reads.
    const files = allowlist();

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).toMatch(/(?<![.\w])fetch\(/);
    }
  });
});
