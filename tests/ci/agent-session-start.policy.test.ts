import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// session-start.sh runs on startup and resume only, and puts the 16 KB skill-routing map
// in on startup: a resumed conversation already holds it.

const HOOK = join(process.cwd(), 'agent-os', 'hooks', 'session-start.sh');
const MAP = join(process.cwd(), 'agent-os', 'docs', 'skill-triggers.md');
const HAS_JQ = spawnSync('/bin/bash', ['-c', 'command -v jq']).status === 0;

interface HookManifest {
  hooks: Array<{ script: string; claude?: { event: string; matcher?: string } }>;
}

describe('agent-os/hooks/session-start.sh', () => {
  let root = '';

  beforeEach(() => {
    // A bare project root: no .mcp files, no install, nothing written outside it.
    root = mkdtempSync(join(tmpdir(), 'fe-session-start-'));
    mkdirSync(join(root, 'agent-os', 'docs'), { recursive: true });
    mkdirSync(join(root, 'agent-os', 'hooks'), { recursive: true });
    copyFileSync(MAP, join(root, 'agent-os', 'docs', 'skill-triggers.md'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function context(source: string): string {
    const result = spawnSync('/bin/bash', [HOOK], {
      encoding: 'utf8',
      input: JSON.stringify({ hook_event_name: 'SessionStart', source }),
      env: { PATH: process.env.PATH ?? '', HOME: root, CLAUDE_PROJECT_DIR: root },
    });
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout) as {
      hookSpecificOutput: { additionalContext: string };
    };
    return output.hookSpecificOutput.additionalContext;
  }

  it('runs for Claude on startup and resume only', () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'agent-os', 'hooks', 'hooks.json'), 'utf8'),
    ) as HookManifest;
    const entry = manifest.hooks.find((hook) => hook.script === 'session-start.sh');
    expect(entry?.claude).toEqual({ event: 'SessionStart', matcher: 'startup|resume' });
  });

  it.skipIf(!HAS_JQ)(
    'injects the routing map on startup and only the summary on resume',
    () => {
      const map = readFileSync(MAP, 'utf8').trim();
      const startup = context('startup');
      expect(startup).toContain(map);

      const resume = context('resume');
      expect(resume).toContain('clinozy-fe session ready');
      expect(resume).not.toContain(map);
      expect(resume).toContain('already earlier in this conversation');
      expect(resume.length).toBeLessThan(startup.length / 10);
    },
  );
});
