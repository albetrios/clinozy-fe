import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const HOOK = join(process.cwd(), 'agent-os', 'hooks', 'fe-gate-failure-hint.mjs');
const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

/** The hook's output for one failed Bash command, and the telemetry row it recorded. */
function failedCommand(command: string) {
  const state = mkdtempSync(join(tmpdir(), 'gate-failure-hint-'));
  temporaryDirectories.push(state);
  const log = join(state, 'telemetry.log');
  const result = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      hook_event_name: 'PostToolUseFailure',
      tool_name: 'Bash',
      tool_input: { command },
    }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: state, HOOK_TELEMETRY_LOG: log },
  });
  const row = readFileSync(log, 'utf8').trim().split('\n').at(-1) ?? '';
  return { result, telemetry: row.split(',').slice(1).join(',') };
}

/**
 * Locks in the gate-failure hint: a failed gate gets its fix hint and records `fired`; any other
 * failed command stays quiet and records `silent`. The planted-bug drill (20 Oct 2026) swapped the
 * two statuses in clinozy-be's twin and no test noticed.
 */
describe('fe-gate-failure-hint.mjs', () => {
  it('hints the fix for a failed gate and records fired', () => {
    const { result, telemetry } = failedCommand('pnpm validate:structure');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('route-island structure');
    expect(telemetry).toBe('fe-gate-failure-hint,PostToolUseFailure,fired');
  });

  it('stays quiet for an ordinary failed command and records silent', () => {
    const { result, telemetry } = failedCommand('grep -q missing README.md');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(telemetry).toBe('fe-gate-failure-hint,PostToolUseFailure,silent');
  });
});
