import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// One hook runtime: every agent hook is a Node script on one helper, agent-os/hooks/_fe-hook.mjs,
// which reads the payload (fail-open), finds the repository root, tells whether a path is in this
// repository and writes the outputs — so no hook needs bash or jq, and no two hooks do one of
// those jobs differently. The hooks used to mix bash + jq scripts with Node ones, each Node hook
// reading stdin and finding the root itself.

const HOOKS = join(process.cwd(), 'agent-os', 'hooks');
const HELPER = '_fe-hook.mjs';
const NOT_HOOK_SCRIPTS = new Set(['README.md', 'hooks.json', 'skill-routing.json']);
const files = readdirSync(HOOKS).filter(
  (file) => !NOT_HOOK_SCRIPTS.has(file) && !file.startsWith('.'),
);
const source = (file: string) => readFileSync(join(HOOKS, file), 'utf8');

interface HookManifest {
  hooks: Array<{
    id: string;
    script: string;
    runtime?: string;
    claude?: { timeout?: number };
  }>;
}

/** A hook script's own time budgets (`const TEST_BUDGET_MILLISECONDS = 60_000;`). */
const BUDGETS = /const \w+_BUDGET_MILLISECONDS = ([\d_]+);/g;

/** Every `command` under the `hooks` key of a generated platform config. */
function hookCommands(path: string): string[] {
  const commands: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value)) {
        if (key === 'command' && typeof inner === 'string') commands.push(inner);
        else visit(inner);
      }
    }
  };
  visit((JSON.parse(readFileSync(path, 'utf8')) as { hooks: unknown }).hooks);
  return commands;
}

describe('one hook runtime', () => {
  it('every script under agent-os/hooks/ is a Node (.mjs) script', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((file) => !file.endsWith('.mjs'))).toEqual([]);
  });

  it('the manifest names Node scripts only and sets no runtime', () => {
    const manifest = JSON.parse(source('hooks.json')) as HookManifest;
    for (const entry of manifest.hooks) {
      expect(entry.script, entry.id).toMatch(/^fe-[a-z-]+\.mjs$/);
      expect(entry.runtime, entry.id).toBeUndefined();
    }
  });

  it.each([
    'agent-os/platforms/claude/settings.json',
    'agent-os/platforms/cursor/hooks.json',
    'agent-os/platforms/codex/hooks.json',
  ])('%s runs every hook with node', (path) => {
    const commands = hookCommands(path);
    expect(commands.length).toBeGreaterThan(0);
    for (const command of commands) {
      expect(command).toMatch(/(?:^|\s)node\s/);
      expect(command).toMatch(/agent-os\/hooks\/fe-[a-z-]+\.mjs"?$/);
      expect(command).not.toMatch(/\bbash\b/);
    }
  });

  it('only the helper reads stdin or works out the repository root', () => {
    for (const file of files.filter((name) => name !== HELPER)) {
      expect(source(file), file).not.toMatch(/readFileSync\(\s*0\b|process\.stdin/);
      expect(source(file), file).not.toMatch(/CLAUDE_PROJECT_DIR\s*\|\|/);
      expect(source(file), file).not.toMatch(
        /fileURLToPath\(import\.meta\.url\)\),\s*'\.\.\/\.\.'/,
      );
    }
    expect(source(HELPER)).toMatch(/process\.env\.CLAUDE_PROJECT_DIR \|\|/);
  });

  it("every hook's timeout covers its own script budgets, run one after another", () => {
    // The planted-bug drill (A8-2, 20 Oct 2026) lowered the turn-end hook's timeout to 60 s, below
    // the 80 s its test selection and test run may take in turn: the platform kills the hook
    // mid-run, which reads as a pass. 10 s is left for the hook's own start-up and git calls.
    const manifest = JSON.parse(source('hooks.json')) as HookManifest;
    const budgeted = manifest.hooks.filter((entry) =>
      source(entry.script).match(BUDGETS),
    );
    expect(budgeted.length).toBeGreaterThan(0);
    for (const entry of budgeted) {
      const total = [...source(entry.script).matchAll(BUDGETS)]
        .map((match) => Number((match[1] ?? '0').replaceAll('_', '')))
        .reduce((sum, value) => sum + value, 0);
      expect((entry.claude?.timeout ?? 0) * 1000, entry.id).toBeGreaterThanOrEqual(
        total + 10_000,
      );
    }
  });

  it('no hook runs jq', () => {
    for (const file of files) expect(source(file), file).not.toMatch(/['"`]jq\b/);
  });
});
