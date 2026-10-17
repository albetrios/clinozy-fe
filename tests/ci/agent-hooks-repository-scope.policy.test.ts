import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

// A session that holds both repos runs both repos' hooks on every edit
// (tooling/agent-os/session-hooks.ts). clinozy-fe's convention rules and its Prettier pass must
// then leave clinozy-be's files alone, while the secret guard still covers every path.
// clinozy-be pins the same rules in agent-os/evals/guard-eval.ts ("repository scope" cases).

const REPOSITORY_ROOT = process.cwd();
const HOOKS = join(REPOSITORY_ROOT, 'agent-os', 'hooks');
/** A file in the other repository of the session — outside this repository's root. */
const SIBLING = join(REPOSITORY_ROOT, '..', 'clinozy-be-scope-test');
const FAKE_ACCESS_KEY = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
const RAW_PALETTE = ['bg', 'red', '500'].join('-');

const temporaryDirectories: string[] = [];

function runHook({ script, payload }: { script: string; payload: unknown }) {
  const runtime = script.endsWith('.mjs') ? process.execPath : '/bin/bash';
  return spawnSync(runtime, [join(HOOKS, script)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: REPOSITORY_ROOT },
  });
}

function decisionOf(stdout: string): string {
  const trimmed = stdout.trim();
  if (!trimmed) return 'silent';
  const parsed = JSON.parse(trimmed) as {
    hookSpecificOutput?: { permissionDecision?: string };
    systemMessage?: string;
  };
  return (
    parsed.hookSpecificOutput?.permissionDecision ??
    (parsed.systemMessage ? 'warn' : 'other')
  );
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe.runIf(process.platform !== 'win32')(
  'agent-os hooks act on this repository only',
  () => {
    it('guard-edits.sh judges this repository and leaves another one alone', () => {
      const edit = (filePath: string) =>
        decisionOf(
          runHook({
            script: 'guard-edits.sh',
            payload: {
              tool_input: {
                file_path: filePath,
                new_string: `className="${RAW_PALETTE}"`,
              },
            },
          }).stdout,
        );

      expect(
        edit(join(REPOSITORY_ROOT, 'src/shared/components/Example/Example.tsx')),
      ).toBe('deny');
      expect(edit('src/shared/components/Example/Example.tsx')).toBe('deny');
      expect(edit(join(SIBLING, 'src/shared/components/Example/Example.tsx'))).toBe(
        'silent',
      );
    });

    it('guardrails.mjs warns only for this repository but blocks secrets everywhere', () => {
      const write = ({ filePath, content }: { filePath: string; content: string }) =>
        decisionOf(
          runHook({
            script: 'guardrails.mjs',
            payload: {
              tool_name: 'Edit',
              tool_input: { file_path: filePath, new_string: content },
            },
          }).stdout,
        );

      expect(
        write({ filePath: join(REPOSITORY_ROOT, 'src/index.css'), content: ':root{}' }),
      ).toBe('warn');
      expect(
        write({ filePath: join(SIBLING, 'src/index.css'), content: ':root{}' }),
      ).toBe('silent');
      expect(
        write({
          filePath: join(SIBLING, 'src/config.ts'),
          content: `const key = "${FAKE_ACCESS_KEY}";`,
        }),
      ).toBe('deny');
    });

    it("format-edits.sh never runs Prettier on another repository's file", () => {
      const directory = mkdtempSync(join(tmpdir(), 'hooks-scope-'));
      temporaryDirectories.push(directory);
      const file = join(directory, 'unformatted.ts');
      const unformatted = 'const   a={b:1}\n';
      writeFileSync(file, unformatted);
      const result = runHook({
        script: 'format-edits.sh',
        payload: { tool_input: { file_path: file } },
      });

      expect(result.status).toBe(0);
      expect(readFileSync(file, 'utf8')).toBe(unformatted);
    });

    it('skill-reminder.sh reminds only for this repository', () => {
      const remind = (filePath: string) =>
        runHook({
          script: 'skill-reminder.sh',
          payload: { tool_input: { file_path: filePath } },
        }).stdout;

      expect(remind(join(REPOSITORY_ROOT, 'src/pages/login/login.route.tsx'))).toContain(
        'fe-route-island',
      );
      expect(remind(join(SIBLING, 'src/pages/login/login.route.tsx'))).toBe('');
    });
  },
);
