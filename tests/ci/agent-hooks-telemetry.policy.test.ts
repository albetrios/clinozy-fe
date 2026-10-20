import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

// The hooks report (tooling/agent-os/hooks-telemetry.ts, clinozy-be's): only a `fired` row counts
// as a fire, a pruning candidate is listed with why it stayed quiet (the detail column of its
// silent rows), and an id hooks.json no longer declares is listed apart as retired.

const REPORT = join(process.cwd(), 'tooling', 'agent-os', 'hooks-telemetry.ts');
const TSX = join(process.cwd(), 'node_modules', '.bin', 'tsx');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

/** The report's output for a checkout holding only a hooks manifest and these telemetry rows. */
function report(rows: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'hooks-telemetry-'));
  temporaryDirectories.push(root);
  mkdirSync(join(root, 'agent-os', 'hooks'), { recursive: true });
  writeFileSync(
    join(root, 'agent-os', 'hooks', 'hooks.json'),
    JSON.stringify({ hooks: [{ id: 'fe-quiet-hook' }, { id: 'fe-busy-hook' }] }),
  );
  writeFileSync(
    join(root, 'agent-os', 'hooks', '.telemetry.log'),
    `${rows.join('\n')}\n`,
  );
  const result = spawnSync(TSX, [REPORT], { cwd: root, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

const now = new Date().toISOString();

describe('hooks-telemetry.ts (pnpm agent-os:hooks:report)', () => {
  it('says why a quiet hook stayed quiet, and lists retired ids apart', () => {
    const output = report([
      `${now},fe-quiet-hook,PostToolUse,silent,not-a-push`,
      `${now},fe-quiet-hook,PostToolUse,silent,not-a-push`,
      `${now},fe-quiet-hook,PostToolUse,silent,not-a-push`,
      `${now},fe-quiet-hook,PostToolUse,silent,no-gh`,
      `${now},fe-busy-hook,Stop,fired,failed`,
      `${now},quiet-hook,PostToolUse,silent`,
    ]);
    expect(output).toContain('fe-quiet-hook: not-a-push 3, no-gh 1');
    expect(output).not.toContain('fe-busy-hook:');
    expect(output).toContain(
      'retired ids still in the log (not in hooks.json): quiet-hook',
    );
  });
});
