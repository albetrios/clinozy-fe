import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { envFileContent, scaffoldGithubEnvFiles } from './scaffold-env-files.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
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

test('a new .env.<environment> carries its blank secrets and its profile defaults', async () => {
  await inTempRoot((root) => {
    const { created } = scaffoldGithubEnvFiles({
      root,
      environments: ENVIRONMENTS,
      profileDefaults: (environment) => DEFAULTS[environment],
    });
    assert.deepEqual(created, ['.env.development', '.env.production']);
    const development = readFileSync(join(root, '.env.development'), 'utf8');
    assert.match(development, /^VITE_API_BASE_URL=$/m);
    assert.match(development, /^NETLIFY_AUTH_TOKEN=$/m);
    assert.match(development, /^VITE_APP_ENV=development$/m);
    assert.match(development, /^VITE_DEVTOOLS=true$/m);
    const production = readFileSync(join(root, '.env.production'), 'utf8');
    assert.match(production, /^VITE_APP_ENV=production$/m);
    assert.match(production, /^VITE_DEVTOOLS=false$/m);
  });
});

test('an existing file is never touched, and a dry run writes nothing', async () => {
  await inTempRoot((root) => {
    writeFileSync(join(root, '.env.production'), 'KEEP=me\n');
    const dry = scaffoldGithubEnvFiles({
      root,
      environments: ENVIRONMENTS,
      dryRun: true,
      profileDefaults: () => assert.fail('a dry run must not read defaults'),
    });
    assert.deepEqual(dry.created, ['.env.development']);
    assert.equal(existsSync(join(root, '.env.development')), false);

    scaffoldGithubEnvFiles({
      root,
      environments: ENVIRONMENTS,
      profileDefaults: (environment) => DEFAULTS[environment],
    });
    assert.equal(readFileSync(join(root, '.env.production'), 'utf8'), 'KEEP=me\n');
  });
});

test('envFileContent writes one KEY=value line per default, after the secrets', () => {
  const content = envFileContent('production', ['A'], { VITE_APP_ENV: 'production' });
  assert.ok(content.indexOf('A=') < content.indexOf('VITE_APP_ENV=production'));
  assert.ok(content.endsWith('\n'));
});

test('the env-registry bridge emits each profile’s defaults, identity included', () => {
  for (const environment of ['development', 'production']) {
    const output = execFileSync(
      'node',
      [
        '--import',
        'tsx',
        join(ROOT, 'tooling/env-registry/env-registry.ts'),
        '--profile-defaults',
        environment,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(JSON.parse(output).VITE_APP_ENV, environment);
  }
});
