import { expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { envFileContent, scaffoldGithubEnvFiles } from './scaffold-env-files.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const TSX = join(ROOT, 'node_modules/.bin/tsx');
const ENVIRONMENTS = [
  { name: 'development', deploySecrets: ['VITE_API_BASE_URL', 'NETLIFY_AUTH_TOKEN'] },
  { name: 'production', deploySecrets: ['VITE_API_BASE_URL'] },
];
const DEFAULTS = {
  development: { VITE_APP_ENV: 'development', VITE_DEVTOOLS: 'true' },
  production: { VITE_APP_ENV: 'production', VITE_DEVTOOLS: 'false' },
};

/** Runs `body` against a throwaway project root, awaited inside the `try`. */
async function inTempRoot(body) {
  const root = mkdtempSync(join(tmpdir(), 'scaffold-env-files-'));
  try {
    return await body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

it('a new .env.<environment> carries its blank secrets and its profile defaults', async () => {
  await inTempRoot((root) => {
    const { created } = scaffoldGithubEnvFiles({
      root,
      environments: ENVIRONMENTS,
      profileDefaults: (environment) => DEFAULTS[environment],
    });
    expect(created).toStrictEqual(['.env.development', '.env.production']);
    const development = readFileSync(join(root, '.env.development'), 'utf8');
    expect(development).toMatch(/^VITE_API_BASE_URL=$/m);
    expect(development).toMatch(/^NETLIFY_AUTH_TOKEN=$/m);
    expect(development).toMatch(/^VITE_APP_ENV=development$/m);
    expect(development).toMatch(/^VITE_DEVTOOLS=true$/m);
    const production = readFileSync(join(root, '.env.production'), 'utf8');
    expect(production).toMatch(/^VITE_APP_ENV=production$/m);
    expect(production).toMatch(/^VITE_DEVTOOLS=false$/m);
  });
});

it('an existing file is never touched, and a dry run writes nothing', async () => {
  await inTempRoot((root) => {
    writeFileSync(join(root, '.env.production'), 'KEEP=me\n');
    const dry = scaffoldGithubEnvFiles({
      root,
      environments: ENVIRONMENTS,
      dryRun: true,
      profileDefaults: () => expect.fail('a dry run must not read defaults'),
    });
    expect(dry.created).toStrictEqual(['.env.development']);
    expect(existsSync(join(root, '.env.development'))).toBe(false);

    scaffoldGithubEnvFiles({
      root,
      environments: ENVIRONMENTS,
      profileDefaults: (environment) => DEFAULTS[environment],
    });
    expect(readFileSync(join(root, '.env.production'), 'utf8')).toBe('KEEP=me\n');
  });
});

it('envFileContent writes one KEY=value line per default, after the secrets', () => {
  const content = envFileContent('production', ['A'], { VITE_APP_ENV: 'production' });
  expect(content.indexOf('A=') < content.indexOf('VITE_APP_ENV=production')).toBeTruthy();
  expect(content.endsWith('\n')).toBeTruthy();
});

it('the env-registry bridge emits each profile’s defaults, identity included', () => {
  for (const environment of ['development', 'production']) {
    const output = execFileSync(
      TSX,
      [
        join(ROOT, 'tooling/env-registry/env-registry.ts'),
        '--profile-defaults',
        environment,
      ],
      { encoding: 'utf8' },
    );
    expect(JSON.parse(output).VITE_APP_ENV).toBe(environment);
  }
});

it('the env-registry bridge refuses an unknown environment', () => {
  const result = spawnSync(
    TSX,
    [join(ROOT, 'tooling/env-registry/env-registry.ts'), '--profile-defaults', 'staging'],
    { encoding: 'utf8' },
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(
    /--profile-defaults needs an environment: local, development, production/,
  );
});
