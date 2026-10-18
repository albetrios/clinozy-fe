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

// The turn-end test hook (agent-os/hooks/fe-turn-end-tests.mjs, clinozy-be's): off by switch, it runs
// only the tests the selection picks for the change itself (not the always-run set), a failure
// exits 2 (asyncRewake wakes the model with the failing tests), a selection of everything wakes it
// once per reason with a heads-up, a passed tree is not run again, and a live run's lock makes the
// next one skip.

const HOOK = join(process.cwd(), 'agent-os', 'hooks', 'fe-turn-end-tests.mjs');
/** The hook's state folder under TMPDIR, as the hook names it. */
const HOOK_STATE = /join\(process\.env\.TMPDIR \|\| '\/tmp', '([a-z-]+)'\)/.exec(
  readFileSync(HOOK, 'utf8'),
)?.[1] as string;
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const SELECTED = {
  mode: 'selected',
  reasons: ['2 of 9 test files'],
  projects: {
    unit: ['src/a.test.ts'],
    security: ['tests/security/token.security.test.ts'],
  },
  why: {
    'src/a.test.ts': ['imports src/a.ts'],
    'tests/security/token.security.test.ts': ['always run'],
  },
};

/**
 * A repository with one uncommitted source file, a stub selector (prints `SELECTION_STUB`) and a
 * stub `vitest` (exits with `VITEST_STUB_EXIT`, records its arguments) — the hook's whole world.
 */
function repository(): { root: string; state: string; runs: string } {
  const root = mkdtempSync(join(tmpdir(), 'turn-end-tests-'));
  const state = mkdtempSync(join(tmpdir(), 'turn-end-tests-state-'));
  temporaryDirectories.push(root, state);
  const git = (...args: string[]) =>
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- fixed 'git' binary, no user input
    spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '--quiet');
  git('config', 'user.email', 'hook@example.com');
  git('config', 'user.name', 'hook');
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 1;\n');
  git('add', '.');
  git('commit', '--quiet', '-m', 'init');
  writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 2;\n');

  mkdirSync(join(root, 'tooling', 'ci'), { recursive: true });
  writeFileSync(
    join(root, 'tooling', 'ci', 'select-tests.mjs'),
    'process.stdout.write(process.env.SELECTION_STUB);\n',
  );
  const bin = join(root, 'node_modules', '.bin');
  mkdirSync(bin, { recursive: true });
  const runs = join(state, 'vitest-runs');
  writeFileSync(
    join(bin, 'vitest'),
    `#!/usr/bin/env bash\necho "$*" >> "${runs}"\nprintf '\\033[41m FAIL \\033[49m src/a.test.ts > a is two\\n'\nexit "\${VITEST_STUB_EXIT:-0}"\n`,
  );
  chmodSync(join(bin, 'vitest'), 0o755);
  return { root, state, runs };
}

function runHook(options: {
  root: string;
  state: string;
  switchValue?: string;
  exitCode?: number;
  selection?: unknown;
  session?: string;
}) {
  return spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      session_id: options.session ?? 's',
      hook_event_name: 'Stop',
    }),
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: options.root,
      TMPDIR: options.state,
      AGENT_TURN_END_TESTS: options.switchValue ?? '1',
      VITEST_STUB_EXIT: String(options.exitCode ?? 0),
      SELECTION_STUB: JSON.stringify(options.selection ?? SELECTED),
    },
  });
}

function runCount(runs: string): number {
  return existsSync(runs) ? readFileSync(runs, 'utf8').trim().split('\n').length : 0;
}

describe('fe-turn-end-tests.mjs', () => {
  it('does nothing when switched off', () => {
    const { root, state, runs } = repository();
    expect(runHook({ root, state, switchValue: '0', exitCode: 1 }).status).toBe(0);
    expect(runCount(runs)).toBe(0);
  });

  it("runs the change's own tests, not the always-run set, and wakes the model on a failure", () => {
    const { root, state, runs } = repository();
    const result = runHook({ root, state, exitCode: 1 });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(' FAIL  src/a.test.ts > a is two');
    expect(result.stderr.includes('\u001b')).toBe(false);
    expect(readFileSync(runs, 'utf8').trim()).toBe('run src/a.test.ts');
  });

  it('remembers a passed tree, and runs again once the tree changes', () => {
    const { root, state, runs } = repository();
    expect(runHook({ root, state }).status).toBe(0);
    expect(runHook({ root, state }).status).toBe(0);
    expect(runCount(runs)).toBe(1);
    writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 3;\n');
    expect(runHook({ root, state }).status).toBe(0);
    expect(runCount(runs)).toBe(2);
  });

  it('says once per reason in a session that the next push runs everything, and runs nothing', () => {
    const { root, state, runs } = repository();
    const all = {
      mode: 'all',
      reasons: ['package.json is on the escalation list, so everything runs'],
      projects: {},
      why: {},
    };
    const first = runHook({ root, state, selection: all });
    expect(first.status).toBe(2);
    expect(first.stderr).toContain('a heads-up, nothing failed');
    expect(first.stderr).toContain('package.json is on the escalation list');
    expect(runHook({ root, state, selection: all }).status).toBe(0);
    expect(runHook({ root, state, selection: all, session: 'next' }).status).toBe(2);
    expect(runCount(runs)).toBe(0);
  });

  it('stays silent when only the always-run set is selected, or the selector cannot answer', () => {
    const { root, state, runs } = repository();
    const alwaysOnly = {
      ...SELECTED,
      projects: { security: ['tests/security/token.security.test.ts'] },
      why: { 'tests/security/token.security.test.ts': ['always run'] },
    };
    expect(runHook({ root, state, selection: alwaysOnly, exitCode: 1 }).status).toBe(0);
    expect(runHook({ root, state, selection: 'not json', exitCode: 1 }).status).toBe(0);
    expect(runCount(runs)).toBe(0);
  });

  it('skips while another run holds the lock', () => {
    const { root, state, runs } = repository();
    expect(HOOK_STATE).toMatch(/-hooks$/);
    mkdirSync(join(state, HOOK_STATE), { recursive: true });
    writeFileSync(join(state, HOOK_STATE, 'fe-turn-end-tests.lock'), String(process.pid));
    expect(runHook({ root, state, exitCode: 1 }).status).toBe(0);
    expect(runCount(runs)).toBe(0);
  });

  it('is registered as an asyncRewake Stop hook with a timeout', () => {
    const settings = readFileSync('agent-os/platforms/claude/settings.json', 'utf8');
    const stop = (JSON.parse(settings) as { hooks: Record<string, unknown[]> }).hooks
      .Stop;
    expect(JSON.stringify(stop)).toContain(
      '"command":"node \\"$CLAUDE_PROJECT_DIR/agent-os/hooks/fe-turn-end-tests.mjs\\"","asyncRewake":true,"timeout":120',
    );
  });
});
