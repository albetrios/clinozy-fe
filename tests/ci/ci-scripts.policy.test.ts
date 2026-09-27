import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Guards the ci:* local-reproduction namespace: it exists, ci:all maps to the
// canonical full gate, and no ci:* script references a pnpm sub-script that
// doesn't exist (typo / drift protection).
const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};
const scripts = pkg.scripts;
const ciScripts = Object.keys(scripts).filter((k) => k.startsWith('ci:'));

describe('ci:* script namespace', () => {
  it('defines the ci:* lane aggregators', () => {
    expect(ciScripts).toEqual(
      expect.arrayContaining(['ci:lint', 'ci:test', 'ci:build', 'ci:all']),
    );
  });

  it('ci:all reproduces the full local gate (health)', () => {
    expect(scripts['ci:all']).toContain('pnpm health');
  });

  it('every pnpm sub-command referenced by a ci:* script exists', () => {
    for (const name of ciScripts) {
      const refs = [...(scripts[name] ?? '').matchAll(/pnpm ([\w:-]+)/g)]
        .map((m) => m[1])
        .filter((r): r is string => Boolean(r));
      for (const ref of refs) {
        expect(
          scripts[ref],
          `${name} references missing script "pnpm ${ref}"`,
        ).toBeDefined();
      }
    }
  });
});
