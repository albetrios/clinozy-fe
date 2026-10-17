import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// docs/reference/project-tree.txt is generated, never committed: every branch that added a file
// changed it, so open branches conflicted on it and forced merges of main. CI checks that the
// generator still lists the repository instead (`pnpm tool:project-structure-tree:check`).

const TREE = 'docs/reference/project-tree.txt';
const GENERATOR = 'tooling/reports/generate-project-tree.py';

function run(command: 'git' | 'python3', args: string[]) {
  return spawnSync(command, args, { encoding: 'utf8' });
}

describe('generated project tree', () => {
  it('is gitignored and untracked', () => {
    expect(run('git', ['ls-files', TREE]).stdout.trim()).toBe('');
    expect(run('git', ['check-ignore', '-q', TREE]).status).toBe(0);
  });

  it('the before-commit guard no longer regenerates or stages it', () => {
    const guard = readFileSync('tooling/validate/before-commit-guard.sh', 'utf8');
    expect(guard).not.toContain(TREE);
    expect(guard).not.toContain('tool:project-structure-tree');
  });

  it('--check builds the tree without writing it', () => {
    const before = existsSync(TREE) ? statSync(TREE).mtimeMs : null;
    const result = run('python3', [GENERATOR, '--check']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('generates');
    expect(existsSync(TREE) ? statSync(TREE).mtimeMs : null).toBe(before);
  });

  it('CI and sync:check still run the generator check', () => {
    expect(readFileSync('.github/workflows/pr-ci.yml', 'utf8')).toContain(
      'run: pnpm tool:project-structure-tree:check',
    );
    expect(readFileSync('tooling/validate/sync-check.sh', 'utf8')).toContain(
      'pnpm tool:project-structure-tree:check',
    );
  });
});
