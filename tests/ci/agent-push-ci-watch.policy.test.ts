import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { gitEnvironmentWithoutInheritedRepository } from '../../tooling/ci/git-environment.mjs';
import {
  createThrowawayRepository,
  removeThrowawayRepositories,
} from '../../tooling/ci/throwaway-repository.mjs';

// The push CI watch (agent-os/hooks/fe-push-ci-watch.mjs, clinozy-be's): a failed run of the pushed
// commit exits 2 (asyncRewake wakes the model) and asks for fe-ci-investigator; a green commit, no
// authenticated gh, or a push in another repository exits 0.

const HOOK = join(process.cwd(), 'agent-os', 'hooks', 'fe-push-ci-watch.mjs');
const temporaryDirectories: string[] = [];

afterEach(() => {
  removeThrowawayRepositories();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/** A repository with one commit, and a stub `gh` that answers `run list` with `runs`. */
function fixture(options: { runs: object[]; authenticated?: boolean }) {
  const { root } = createThrowawayRepository({
    prefix: 'push-ci-watch-',
    files: { 'README.md': '# fixture\n' },
  });
  const state = mkdtempSync(join(tmpdir(), 'push-ci-watch-state-'));
  temporaryDirectories.push(state);
  const bin = join(state, 'bin');
  mkdirSync(bin);
  const calls = join(state, 'gh-calls');
  writeFileSync(join(state, 'runs.json'), JSON.stringify(options.runs));
  writeFileSync(
    join(bin, 'gh'),
    [
      '#!/usr/bin/env bash',
      `echo "$*" >> "${calls}"`,
      `if [ "$1" = auth ]; then exit ${options.authenticated === false ? 1 : 0}; fi`,
      `cat "${join(state, 'runs.json')}"`,
    ].join('\n'),
  );
  chmodSync(join(bin, 'gh'), 0o755);
  return { root, state, bin, calls };
}

function runHook(options: {
  root: string;
  state: string;
  bin: string;
  command?: string;
}) {
  return spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: options.command ?? 'git push -u origin feat/x' },
      cwd: options.root,
    }),
    encoding: 'utf8',
    env: {
      ...gitEnvironmentWithoutInheritedRepository(),
      CLAUDE_PROJECT_DIR: options.root,
      TMPDIR: options.state,
      PATH: `${options.bin}:${process.env.PATH ?? ''}`,
      PUSH_CI_WATCH_POLL_MILLISECONDS: '10',
    },
  });
}

const run = (name: string, conclusion: string) => ({
  databaseId: 1,
  name,
  status: 'completed',
  conclusion,
  url: `https://github.example/runs/${name}`,
});

describe('fe-push-ci-watch.mjs', () => {
  it('wakes the model with each failed run of the pushed commit', () => {
    const watched = fixture({
      runs: [run('PR CI', 'failure'), run('Docs lane', 'success')],
    });
    const result = runHook(watched);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('PR CI: failure — https://github.example/runs/PR CI');
    expect(result.stderr).not.toContain('Docs lane');
    expect(result.stderr).toContain('fe-ci-investigator');
  });

  it('counts a cancelled run while HEAD is still the pushed commit', () => {
    expect(runHook(fixture({ runs: [run('PR CI', 'cancelled')] })).status).toBe(2);
  });

  it('stays silent on a green commit and without an authenticated gh', () => {
    expect(runHook(fixture({ runs: [run('PR CI', 'success')] })).status).toBe(0);
    const unauthenticated = fixture({
      runs: [run('PR CI', 'failure')],
      authenticated: false,
    });
    expect(runHook(unauthenticated).status).toBe(0);
    expect(readFileSync(unauthenticated.calls, 'utf8')).not.toContain('run list');
  });

  it('judges only pushes in its own repository', () => {
    const watched = fixture({ runs: [run('PR CI', 'failure')] });
    const elsewhere = mkdtempSync(join(tmpdir(), 'push-ci-elsewhere-'));
    temporaryDirectories.push(elsewhere);
    expect(runHook({ ...watched, command: `cd ${elsewhere} && git push` }).status).toBe(
      0,
    );
    expect(existsSync(watched.calls)).toBe(false);
  });

  it('is registered on git push only, in the background, with a 45-minute timeout', () => {
    const settings = JSON.parse(
      readFileSync('agent-os/platforms/claude/settings.json', 'utf8'),
    ) as { hooks: Record<string, unknown[]> };
    expect(JSON.stringify(settings.hooks.PostToolUse)).toContain(
      '"command":"node \\"$CLAUDE_PROJECT_DIR/agent-os/hooks/fe-push-ci-watch.mjs\\"","if":"Bash(git push*)","asyncRewake":true,"timeout":2700',
    );
  });
});
