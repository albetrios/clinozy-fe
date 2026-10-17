import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// The PR's ESLint and TypeScript lanes restore caches that the nightly saves on main (a PR-scoped
// cache dies with the PR, cleanup-cache.yml), and Semgrep runs from its pinned image.

const prCi = readFileSync('.github/workflows/pr-ci.yml', 'utf8');
const nightly = readFileSync('.github/workflows/scheduled-unit-nightly.yml', 'utf8');
const scripts = (
  JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
).scripts;
const tsconfigApp = readFileSync('tsconfig.app.json', 'utf8');

/** A top-level job block, from its `  <name>:` header to the next job key. */
function jobBlock(workflow: string, name: string): string {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  if (start === -1) return '';
  const lines = workflow.slice(start + 1).split('\n');
  const out: string[] = [lines[0] ?? ''];
  for (const line of lines.slice(1)) {
    if (/^ {2}\S/.test(line)) break;
    out.push(line);
  }
  return out.join('\n');
}

const ESLINT_KEY =
  "eslint-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml', 'eslint.config.mjs') }}-";
const TSC_KEY =
  "tsc-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml', 'tsconfig*.json') }}-";

describe('CI lane caches', () => {
  it('lints with a content-keyed ESLint cache', () => {
    expect(scripts.lint).toContain(
      '--cache --cache-location node_modules/.cache/eslint/',
    );
    expect(scripts.lint).toContain('--cache-strategy content');
  });

  it('type-checks incrementally into the build-info file the lanes cache', () => {
    expect(scripts['type-check']).toContain('--incremental');
    expect(tsconfigApp).toContain(
      '"tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo"',
    );
  });

  it('restores main’s caches in the PR lanes, after the install', () => {
    const lint = jobBlock(prCi, 'lint');
    expect(lint).toContain('actions/cache/restore@');
    expect(lint).toContain('path: node_modules/.cache/eslint');
    expect(lint).toContain(ESLINT_KEY);
    expect(lint.indexOf('setup-node-pnpm')).toBeLessThan(
      lint.indexOf('actions/cache/restore@'),
    );
    const typecheck = jobBlock(prCi, 'typecheck');
    expect(typecheck).toContain('path: node_modules/.tmp/tsconfig.app.tsbuildinfo');
    expect(typecheck).toContain(TSC_KEY);
    expect(prCi).not.toContain('actions/cache/save@');
  });

  it('saves both on main only, from the nightly', () => {
    const caches = jobBlock(nightly, 'main-caches');
    expect(caches.match(/actions\/cache\/save@/g)).toHaveLength(2);
    expect(caches).toContain(ESLINT_KEY);
    expect(caches).toContain(TSC_KEY);
    expect(caches.match(/github\.ref == 'refs\/heads\/main'/g)).toHaveLength(2);
  });

  it('runs Semgrep from its image, pinned by digest', () => {
    const sast = jobBlock(prCi, 'security-sast');
    expect(sast).toMatch(/image: semgrep\/semgrep:\d+\.\d+\.\d+@sha256:[0-9a-f]{64}/);
    expect(sast).not.toMatch(/run: pip install/);
    expect(sast).toContain("SEMGREP_ENABLE_VERSION_CHECK: '0'");
  });
});
