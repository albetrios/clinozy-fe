import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { gitEnvironmentWithoutInheritedRepository } from '../../tooling/ci/git-environment.mjs';
import {
  createThrowawayRepository,
  removeThrowawayRepositories,
} from '../../tooling/ci/throwaway-repository.mjs';

// The session-end note (agent-os/hooks/fe-session-end.mjs): it warns about uncommitted work in a
// cloud session (telemetry `fired`) and says the tree is clean otherwise (`silent`), and it always
// exits 0 — a hook error at session end must never be the last thing a session prints.

const HOOK = join(process.cwd(), 'agent-os', 'hooks', 'fe-session-end.mjs');
const temporaryDirectories: string[] = [];

afterEach(() => {
  removeThrowawayRepositories();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function runHook(root: string) {
  const state = mkdtempSync(join(tmpdir(), 'session-end-state-'));
  temporaryDirectories.push(state);
  const log = join(state, 'telemetry.log');
  const result = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: 'SessionEnd' }),
    encoding: 'utf8',
    env: {
      ...gitEnvironmentWithoutInheritedRepository(),
      CLAUDE_PROJECT_DIR: root,
      HOOK_TELEMETRY_LOG: log,
    },
  });
  const row = readFileSync(log, 'utf8').trim().split(',').slice(2).join(',');
  return { ...result, row };
}

describe('fe-session-end.mjs', () => {
  it('warns about uncommitted work and records fired', () => {
    const { root } = createThrowawayRepository({
      prefix: 'session-end-',
      files: { 'README.md': '# fixture\n' },
    });
    writeFileSync(join(root, 'notes.md'), 'uncommitted\n');
    const result = runHook(root);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Session ending with 1 uncommitted change(s)');
    expect(result.row).toBe('SessionEnd,fired');
  });

  it('says the tree is clean and records silent', () => {
    const { root } = createThrowawayRepository({
      prefix: 'session-end-',
      files: { 'README.md': '# fixture\n' },
    });
    const result = runHook(root);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('working tree clean');
    expect(result.row).toBe('SessionEnd,silent');
  });
});
