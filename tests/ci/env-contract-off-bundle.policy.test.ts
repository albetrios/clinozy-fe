import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { clientEnvSchema } from '../../src/core/config/client-env-schema.ts';
import { envSchemaBase } from '../../src/core/config/env-schema.ts';

const ROOT = process.cwd();

/** Every shipped source file under `src/` — tests and test support excluded. */
function shippedSources(dir = join(ROOT, 'src')): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'fixtures') continue;
      found.push(...shippedSources(path));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

/**
 * The env contract stays off the bundle (F-8). `src/core/config/env-schema.ts` holds every key
 * — the deploy secrets' names (`NETLIFY_AUTH_TOKEN`, `RELEASE_PLEASE_TOKEN`), local tooling
 * (`SONAR_ADMIN_PASSWORD`), the forbidden-value rules and the per-environment profiles — for the
 * tooling. A single app import of it put all of that in the entry chunk; the app reads the
 * client slice, `client-env-schema.ts`, alone.
 */
describe('the env contract is tooling-only', () => {
  it('no shipped module imports env-schema.ts', () => {
    const importers = shippedSources()
      .filter((path) =>
        /from ['"][^'"]*\/env-schema\.ts['"]/.test(readFileSync(path, 'utf8')),
      )
      .map((path) => relative(ROOT, path));
    expect(importers).toEqual([]);
  });

  it('the client schema names every VITE_ key the contract has, and nothing else', () => {
    // VITE_APP_VERSION reaches the client through `lib/i18n/build-env.ts`, not this schema.
    const contractClientKeys = Object.keys(envSchemaBase.shape)
      .filter((key) => key.startsWith('VITE_') && key !== 'VITE_APP_VERSION')
      .sort();
    // VITE_TEST_MODE is the test runner's mark (plugins/test-env.ts), never set by a deploy.
    const clientKeys = Object.keys(clientEnvSchema.shape)
      .filter((key) => key !== 'VITE_TEST_MODE')
      .sort();
    expect(clientKeys).toEqual(contractClientKeys);
  });

  it('the client schema names no build, deploy or tooling key', () => {
    expect(
      Object.keys(clientEnvSchema.shape).filter((key) => !key.startsWith('VITE_')),
    ).toEqual([]);
  });
});
