import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitEnvironmentWithoutInheritedRepository } from '../ci/git-environment.mjs';
import {
  createThrowawayRepository,
  removeThrowawayRepositories,
} from '../ci/throwaway-repository.mjs';
import { isNeverCommitted, neverCommittedPaths } from './never-committed.mjs';

// The gitignored secret and state files are refused by one list, read by the before-commit
// guard's step 8 (the staged files) and the pr-governance CI guard (the PR diff). Before, both
// carried their own `.env*`-only grep.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = join(ROOT, 'tooling/validate/never-committed.mjs');
const GUARD = readFileSync(join(ROOT, 'tooling/validate/before-commit-guard.sh'), 'utf8');
const WORKFLOW = readFileSync(join(ROOT, '.github/workflows/pr-governance.yml'), 'utf8');

/** The guard's step 8 (the `step_8` function), as a script of its own. */
const STEP_EIGHT = GUARD.slice(GUARD.indexOf('# ── 8.'), GUARD.indexOf('# ── 9.'));

afterEach(removeThrowawayRepositories);

describe('the never-committed list', () => {
  it.each([
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.staging.backup',
    '.env.sentry-build-plugin',
    '.sentryclirc',
    'apps/web/.sentryclirc',
    'tests/e2e/.e2e-auth-headers.json',
    '.netlify/state.json',
  ])('refuses %s', (path) => {
    expect(isNeverCommitted(path)).toBe(true);
  });

  it.each([
    '.env.example',
    '.envrc',
    'src/.env.ts',
    'docs/env.md',
    'tests/e2e/auth.e2e.test.ts',
    '.netlify/netlify.toml.example',
    'netlify.toml',
  ])('lets %s through', (path) => {
    expect(isNeverCommitted(path)).toBe(false);
  });

  it('keeps the listed order', () => {
    expect(
      neverCommittedPaths(['src/a.ts', '.sentryclirc', '.env.example', '.env']),
    ).toEqual(['.sentryclirc', '.env']);
  });

  it('prints each refused path from a piped list and exits 1; a clean list exits 0', () => {
    const refused = spawnSync(process.execPath, [SCRIPT], {
      input: 'src/a.ts\n.netlify/state.json\n.env.example\n\n',
      encoding: 'utf8',
    });
    expect(refused.status).toBe(1);
    expect(refused.stdout).toBe('.netlify/state.json\n');
    const clean = spawnSync(process.execPath, [SCRIPT], {
      input: 'src/a.ts\n.env.example\n',
      encoding: 'utf8',
    });
    expect(clean.status).toBe(0);
    expect(clean.stdout).toBe('');
  });
});

describe('both checks read the one list', () => {
  /** Runs step 8 in a repository whose index holds `files`, force-added past .gitignore. */
  function stepEight(files) {
    const repository = createThrowawayRepository({ prefix: 'never-committed-' });
    symlinkSync(join(ROOT, 'tooling'), join(repository.root, 'tooling'));
    repository.writeFiles(files);
    repository.git(['add', '-f', ...Object.keys(files)]);
    return spawnSync('sh', ['-c', `${STEP_EIGHT}\nstep_8`], {
      cwd: repository.root,
      encoding: 'utf8',
      env: gitEnvironmentWithoutInheritedRepository(),
    });
  }

  it('step 8 blocks a staged secret or state file', () => {
    for (const path of [
      '.sentryclirc',
      'tests/e2e/.e2e-auth-headers.json',
      '.env.local',
    ]) {
      const result = stepEight({ [path]: 'x\n', 'src/a.ts': 'export {};\n' });
      expect(result.status, path).toBe(1);
      expect(result.stdout).toContain('must never be committed');
      expect(result.stdout).toContain(path);
      expect(result.stdout).not.toContain('src/a.ts');
    }
  });

  it('step 8 lets the env template and source through', () => {
    const result = stepEight({ '.env.example': 'VITE_X=\n', 'src/a.ts': 'export {};\n' });
    expect(result.status, result.stdout).toBe(0);
  });

  it('the before-commit step and the PR guard pipe into the script, with no list of their own', () => {
    expect(STEP_EIGHT).toContain('| node tooling/validate/never-committed.mjs');
    expect(WORKFLOW).toContain('| node tooling/validate/never-committed.mjs');
    for (const check of [STEP_EIGHT, WORKFLOW]) {
      expect(check).not.toMatch(/grep -[vE]+ '\^\\\.env/);
    }
  });
});
