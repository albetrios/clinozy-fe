import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/**
 * Sentry source-map upload guard. Every `vite build` is mode `production`, and the local env
 * files carry `SENTRY_AUTH_TOKEN` (they are what `pnpm github:sync` pushes from), so gating the
 * upload on the token alone made every local build — `pnpm health`, the pre-push hook, a
 * one-off `pnpm build` — upload source maps and create a Sentry release for code that never
 * shipped. The upload now needs `SENTRY_UPLOAD_SOURCEMAPS=true`, set by the deploy workflow's
 * build step or by `pnpm build --sentry`, and read from the process env BEFORE any env file
 * loads, so no file can switch it on.
 */
describe('Sentry source-map upload', () => {
  const config = read('vite.config.ts');

  it('vite.config.ts reads the switch from the process env before any env file loads', () => {
    const switchAt = config.indexOf("process.env.SENTRY_UPLOAD_SOURCEMAPS === 'true'");
    expect(switchAt).toBeGreaterThan(-1);
    expect(switchAt).toBeLessThan(config.indexOf('applyBuildEnvironment({'));
    expect(switchAt).toBeLessThan(config.indexOf('loadEnv(mode'));
    expect(config).toMatch(
      /const uploadSourceMaps = process\.env\.SENTRY_UPLOAD_SOURCEMAPS/,
    );
  });

  it('the Sentry plugin needs the switch as well as the token', () => {
    const call = config.indexOf('sentryVitePlugin({');
    expect(call).toBeGreaterThan(-1);
    expect(config.indexOf('sentryVitePlugin({', call + 1)).toBe(-1);
    // The `...(<gate> ? [sentryVitePlugin(…)] : [])` spread around the one call.
    const spread = config.lastIndexOf('...(', call);
    const gate = config.slice(spread + '...('.length, config.indexOf('?', spread));
    expect(gate.split(/\s+/).join(' ').trim()).toBe(
      "mode === 'production' && uploadSourceMaps && env.SENTRY_AUTH_TOKEN",
    );
  });

  it('the deploy build step switches uploads on, outside the materialized env file', () => {
    const deploy = read('.github/workflows/reusable-netlify-deploy.yml');
    expect(deploy).toMatch(/\n {10}SENTRY_UPLOAD_SOURCEMAPS: 'true'\n/);
    const materialized = /for key in ([\s\S]*?); do/.exec(deploy)?.[1] ?? '';
    expect(materialized).not.toContain('SENTRY_UPLOAD_SOURCEMAPS');
  });

  it('no other workflow switches uploads on', () => {
    for (const name of [
      'preview.yml',
      'pr-ci.yml',
      'lighthouse.yml',
      'cross-browser.yml',
    ]) {
      expect(read(`.github/workflows/${name}`), name).not.toContain(
        'SENTRY_UPLOAD_SOURCEMAPS',
      );
    }
  });

  it('pnpm build passes the switch only for --sentry', () => {
    const wrapper = read('tooling/ci/build.mjs');
    expect(wrapper).toContain("const SENTRY_VARIABLE = 'SENTRY_UPLOAD_SOURCEMAPS';");
    expect(wrapper).toMatch(
      /\.\.\.\(sentry \? \{ \[SENTRY_VARIABLE\]: 'true' \} : \{\}\)/,
    );
  });
});
