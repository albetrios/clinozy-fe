import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type ConfigEnv, loadEnv } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  assertDevServerMode,
  DEV_SERVER_MODE,
  devServerMode,
} from '../../plugins/dev-server-mode.ts';

const ROOT = process.cwd();

/**
 * Dev-server env guard. `.env.local` is the `local` environment's file, and
 * `.env.development` / `.env.production` are the deploy-env files `pnpm github:sync` pushes
 * from. Vite loads `.env.<mode>` AFTER `.env.local`, so a dev server in Vite's default
 * `development` mode let `.env.development` override `.env.local` key by key — on
 * 2026-10-03 the local login page called the hosted development API instead of clinozy-be.
 * `pnpm dev` therefore runs in its own mode, which no env file is named after, and
 * `vite.config.ts` refuses to serve in any other.
 *
 * The probe keys carry their own prefix so the runner's `process.env` (which `loadEnv`
 * also reads) can never answer for a file.
 */
const PREFIX = 'CLINOZY_PROBE_';

describe('dev server env precedence', () => {
  let envDir = '';

  beforeAll(() => {
    envDir = mkdtempSync(join(tmpdir(), 'clinozy-dev-server-env-'));
    // `.env.local` leaves the API base empty: same-origin, through the Vite proxy.
    writeFileSync(
      join(envDir, '.env.local'),
      `${PREFIX}API_BASE_URL=\n${PREFIX}LOCAL_ONLY=local\n`,
    );
    writeFileSync(
      join(envDir, '.env.development'),
      `${PREFIX}API_BASE_URL=https://development--api.example.com\n${PREFIX}DEPLOY_ONLY=development\n`,
    );
    writeFileSync(
      join(envDir, '.env.production'),
      `${PREFIX}API_BASE_URL=https://api.example.com\n${PREFIX}DEPLOY_ONLY=production\n`,
    );
  });

  afterAll(() => {
    rmSync(envDir, { recursive: true, force: true });
  });

  it('pnpm dev starts Vite in the dev-server mode', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.dev).toBe(`vite --mode ${DEV_SERVER_MODE}`);
  });

  it('the dev-server mode reads .env.local and no deploy-env file', () => {
    const env = loadEnv(DEV_SERVER_MODE, envDir, PREFIX);
    expect(env).toEqual({
      [`${PREFIX}API_BASE_URL`]: '',
      [`${PREFIX}LOCAL_ONLY`]: 'local',
    });
  });

  it("Vite's default development mode lets .env.development win (why the mode exists)", () => {
    const env = loadEnv('development', envDir, PREFIX);
    expect(env[`${PREFIX}API_BASE_URL`]).toBe('https://development--api.example.com');
    expect(env[`${PREFIX}DEPLOY_ONLY`]).toBe('development');
  });

  it('the dev-server mode is not an environment name or a reserved Vite mode', () => {
    expect(['local', 'development', 'production', 'test']).not.toContain(DEV_SERVER_MODE);
  });

  it('refuses a dev server in any other mode', () => {
    for (const mode of ['development', 'production', 'test']) {
      expect(() =>
        assertDevServerMode({ command: 'serve', mode, isPreview: false }),
      ).toThrow(`.env.${mode} on top of .env.local`);
    }
    expect(() =>
      assertDevServerMode({ command: 'serve', mode: DEV_SERVER_MODE, isPreview: false }),
    ).not.toThrow();
  });

  it('leaves builds and vite preview alone', () => {
    expect(() =>
      assertDevServerMode({ command: 'build', mode: 'production', isPreview: false }),
    ).not.toThrow();
    expect(() =>
      assertDevServerMode({ command: 'serve', mode: 'production', isPreview: true }),
    ).not.toThrow();
  });

  it('the plugin runs the guard in its config hook, before Vite loads env files', () => {
    const { config } = devServerMode();
    expect(typeof config).toBe('function');
    const hook = config as (config: object, env: ConfigEnv) => void;
    expect(() =>
      hook({}, { command: 'serve', mode: 'development', isPreview: false }),
    ).toThrow(`mode "${DEV_SERVER_MODE}"`);
    expect(() =>
      hook({}, { command: 'serve', mode: DEV_SERVER_MODE, isPreview: false }),
    ).not.toThrow();
  });

  it('vite.config.ts registers the plugin first', () => {
    const config = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    expect(config).toMatch(/plugins:\s*\[\s*(\/\/[^\n]*\n\s*)*devServerMode\(\),/);
  });
});
