import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadEnv } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  applyBuildEnvironment,
  BUILD_DEFAULTS_VARIABLE,
  BUILD_ENVIRONMENT_VARIABLE,
  BUILD_ENVIRONMENTS,
} from '../../plugins/build-environment.ts';
import { envProfiles } from '../../src/core/config/env-schema.ts';
import {
  childEnvironment,
  chooseEnvironment,
  DEFAULTS_VARIABLE,
  ENVIRONMENTS,
  parseBuildArguments,
} from '../../tooling/ci/build.mjs';

const ROOT = process.cwd();

/**
 * Build-environment guard. A build is Vite mode `production`, so on its own Vite reads
 * `.env.local` and lays `.env.production` over it. `pnpm build` asks which environment to
 * build with (`tooling/ci/build.mjs`) and passes `BUILD_ENVIRONMENT`; `vite.config.ts` then
 * reads `.env.<environment>` ALONE (`plugins/build-environment.ts`). With nothing chosen it
 * reads `.env.local` alone — clinozy-be's default for an unset `NODE_ENV` — and only where
 * there is no `.env.local` (CI, deploys) do Vite's own files load. These checks pin that one
 * file is read, that the shell still wins, and that CI and deploys are unchanged.
 *
 * The probe keys carry their own prefix so the runner's real env can never answer for a file.
 */
const PREFIX = 'CLINOZY_PROBE_';

describe('build environment', () => {
  let root = '';

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'clinozy-build-environment-'));
    writeFileSync(
      join(root, '.env.local'),
      `${PREFIX}API_BASE_URL=\n${PREFIX}LOCAL_ONLY=local\n${PREFIX}FROM_SHELL=local\n`,
    );
    writeFileSync(
      join(root, '.env.development'),
      `${PREFIX}API_BASE_URL=https://development--api.example.com\n${PREFIX}FROM_SHELL=development\n`,
    );
    writeFileSync(
      join(root, '.env.production'),
      `${PREFIX}API_BASE_URL=https://api.example.com\n${PREFIX}PRODUCTION_ONLY=production\n`,
    );
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('a chosen environment reads its env file alone, and the shell still wins', () => {
    const processEnv: NodeJS.ProcessEnv = {
      [BUILD_ENVIRONMENT_VARIABLE]: 'development',
      [`${PREFIX}FROM_SHELL`]: 'shell',
    };
    expect(applyBuildEnvironment({ command: 'build', root, processEnv })).toBe(false);
    expect(processEnv).toEqual({
      [BUILD_ENVIRONMENT_VARIABLE]: 'development',
      [`${PREFIX}API_BASE_URL`]: 'https://development--api.example.com',
      [`${PREFIX}FROM_SHELL`]: 'shell',
      VITE_APP_ENV: 'development',
    });
  });

  it('the bundle reports the environment it was built for (VITE_APP_ENV)', () => {
    // Left out of the file: filled in from the choice.
    const filled: NodeJS.ProcessEnv = { [BUILD_ENVIRONMENT_VARIABLE]: 'production' };
    applyBuildEnvironment({ command: 'build', root, processEnv: filled });
    expect(filled.VITE_APP_ENV).toBe('production');

    // Blank in the shell counts as left out; the same name is kept.
    const blank: NodeJS.ProcessEnv = {
      [BUILD_ENVIRONMENT_VARIABLE]: 'local',
      VITE_APP_ENV: '',
    };
    applyBuildEnvironment({ command: 'build', root, processEnv: blank });
    expect(blank.VITE_APP_ENV).toBe('local');

    // Another environment's name — from the shell or from the file — is refused.
    expect(() =>
      applyBuildEnvironment({
        command: 'build',
        root,
        processEnv: {
          [BUILD_ENVIRONMENT_VARIABLE]: 'production',
          VITE_APP_ENV: 'development',
        },
      }),
    ).toThrow('VITE_APP_ENV=development — it must be production');
    const mislabelled = mkdtempSync(join(tmpdir(), 'clinozy-build-environment-label-'));
    try {
      writeFileSync(join(mislabelled, '.env.production'), 'VITE_APP_ENV=local\n');
      expect(() =>
        applyBuildEnvironment({
          command: 'build',
          root: mislabelled,
          processEnv: { [BUILD_ENVIRONMENT_VARIABLE]: 'production' },
        }),
      ).toThrow('VITE_APP_ENV=local — it must be production');
    } finally {
      rmSync(mislabelled, { recursive: true, force: true });
    }
  });

  it('Vite, given envDir false, builds from exactly those values', () => {
    const keys = Object.keys(process.env).filter((key) => key.startsWith(PREFIX));
    expect(keys).toEqual([]);
    const appEnvBefore = process.env.VITE_APP_ENV;
    try {
      process.env[BUILD_ENVIRONMENT_VARIABLE] = 'local';
      const envDir = applyBuildEnvironment({ command: 'build', root });
      expect(loadEnv('production', envDir, PREFIX)).toEqual({
        [`${PREFIX}API_BASE_URL`]: '',
        [`${PREFIX}LOCAL_ONLY`]: 'local',
        [`${PREFIX}FROM_SHELL`]: 'local',
      });
    } finally {
      delete process.env[BUILD_ENVIRONMENT_VARIABLE];
      if (appEnvBefore === undefined) delete process.env.VITE_APP_ENV;
      else process.env.VITE_APP_ENV = appEnvBefore;
      for (const key of Object.keys(process.env).filter((name) =>
        name.startsWith(PREFIX),
      )) {
        delete process.env[key];
      }
    }
  });

  it('unchosen, a build reads .env.local alone (the local default, as in clinozy-be)', () => {
    for (const chosen of [undefined, '']) {
      const processEnv: NodeJS.ProcessEnv =
        chosen === undefined ? {} : { [BUILD_ENVIRONMENT_VARIABLE]: chosen };
      expect(applyBuildEnvironment({ command: 'build', root, processEnv })).toBe(false);
      expect(processEnv[`${PREFIX}LOCAL_ONLY`]).toBe('local');
      expect(processEnv[`${PREFIX}API_BASE_URL`]).toBe('');
      expect(processEnv[`${PREFIX}PRODUCTION_ONLY`]).toBeUndefined();
    }
  });

  it("unchosen without a .env.local (CI, deploys), Vite's own files load as before", () => {
    const ci = mkdtempSync(join(tmpdir(), 'clinozy-build-environment-ci-'));
    try {
      writeFileSync(
        join(ci, '.env.production.local'),
        `${PREFIX}API_BASE_URL=https://api.example.com\n`,
      );
      const processEnv: NodeJS.ProcessEnv = {};
      expect(applyBuildEnvironment({ command: 'build', root: ci, processEnv })).toBe(ci);
      expect(processEnv).toEqual({});
      expect(loadEnv('production', ci, PREFIX)).toEqual({
        [`${PREFIX}API_BASE_URL`]: 'https://api.example.com',
      });
    } finally {
      rmSync(ci, { recursive: true, force: true });
    }
  });

  // `pnpm build --defaults` builds as CI's Build verify lane does — no env file, no shell VITE_* —
  // so the pre-push size budget measures the bundle the budget was set on.
  it('--defaults reads no env file, even beside a .env.local', () => {
    const processEnv: NodeJS.ProcessEnv = { [BUILD_DEFAULTS_VARIABLE]: 'true' };
    const envDir = applyBuildEnvironment({ command: 'build', root, processEnv });
    expect(envDir).toBe(join(root, 'tooling/test/empty-env'));
    expect(processEnv[`${PREFIX}LOCAL_ONLY`]).toBeUndefined();
    expect(loadEnv('production', envDir as string, PREFIX)).toEqual({});
    expect(() =>
      applyBuildEnvironment({
        command: 'build',
        root,
        processEnv: {
          [BUILD_DEFAULTS_VARIABLE]: 'true',
          [BUILD_ENVIRONMENT_VARIABLE]: 'local',
        },
      }),
    ).toThrow(/reads no env file/);
  });

  it('pnpm build --defaults drops shell VITE_* and never asks', async () => {
    expect(DEFAULTS_VARIABLE).toBe(BUILD_DEFAULTS_VARIABLE);
    expect(parseBuildArguments(['--defaults'])).toEqual({ defaults: true });
    expect(() => parseBuildArguments(['--defaults', '--env', 'local'])).toThrow(
      /--defaults/,
    );
    const child = childEnvironment({
      defaults: true,
      env: {
        PATH: '/bin',
        VITE_POSTHOG_KEY: 'shell',
        [BUILD_ENVIRONMENT_VARIABLE]: 'local',
      },
    });
    expect(child).toEqual({ PATH: '/bin', [DEFAULTS_VARIABLE]: 'true' });
    let asked = false;
    const chosen = await chooseEnvironment({
      argv: ['--defaults'],
      env: {},
      root,
      interactive: true,
      ask: () => {
        asked = true;
        return Promise.resolve('local');
      },
    });
    expect(chosen).toBeUndefined();
    expect(asked).toBe(false);
  });

  it('the dev server and vite preview ignore BUILD_ENVIRONMENT', () => {
    const processEnv: NodeJS.ProcessEnv = { [BUILD_ENVIRONMENT_VARIABLE]: 'production' };
    expect(applyBuildEnvironment({ command: 'serve', root, processEnv })).toBe(root);
    expect(Object.keys(processEnv)).toEqual([BUILD_ENVIRONMENT_VARIABLE]);
  });

  it('refuses an unknown environment and a missing env file', () => {
    expect(() =>
      applyBuildEnvironment({
        command: 'build',
        root,
        processEnv: { [BUILD_ENVIRONMENT_VARIABLE]: 'staging' },
      }),
    ).toThrow('"staging" is not an environment');
    const empty = mkdtempSync(join(tmpdir(), 'clinozy-build-environment-empty-'));
    try {
      expect(() =>
        applyBuildEnvironment({
          command: 'build',
          root: empty,
          processEnv: { [BUILD_ENVIRONMENT_VARIABLE]: 'production' },
        }),
      ).toThrow('there is no .env.production');
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('the environment lists match the env schema', () => {
    expect([...BUILD_ENVIRONMENTS]).toEqual(Object.keys(envProfiles));
    expect(ENVIRONMENTS).toEqual([...BUILD_ENVIRONMENTS]);
  });

  it('pnpm build asks; build:bundle is the chain it runs; vite.config.ts applies the choice', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.build).toBe('node tooling/ci/build.mjs');
    expect(pkg.scripts['build:bundle']).toBe(
      'tsc -b && vite build && node tooling/ci/strip-sourcemaps.mjs',
    );
    // A production deploy from a laptop never stops to ask — and never builds anything else.
    expect(pkg.scripts['deploy:netlify:prod']).toMatch(
      /^pnpm build --env production && /,
    );

    const config = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    expect(config).toMatch(
      /const envDir = applyBuildEnvironment\(\{ command, root: import\.meta\.dirname \}\);\s*const env = loadEnv\(mode, envDir, ''\);/,
    );
    expect(config).toMatch(/return \{\s*envDir,/);
  });
});
