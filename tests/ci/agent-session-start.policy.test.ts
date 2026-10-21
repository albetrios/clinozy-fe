import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// fe-session-start.mjs runs on startup and resume only, and puts the 16 KB skill-routing map
// in on startup: a resumed conversation already holds it.

const HOOK = join(process.cwd(), 'agent-os', 'hooks', 'fe-session-start.mjs');
const MAP = join(process.cwd(), 'agent-os', 'docs', 'skill-triggers.md');

interface HookManifest {
  hooks: Array<{ script: string; claude?: { event: string; matcher?: string } }>;
}

describe('agent-os/hooks/fe-session-start.mjs', () => {
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
    const result = spawnSync(process.execPath, [HOOK], {
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
    const entry = manifest.hooks.find((hook) => hook.script === 'fe-session-start.mjs');
    expect(entry?.claude).toEqual({ event: 'SessionStart', matcher: 'startup|resume' });
  });

  it('injects the routing map on startup and only the summary on resume', () => {
    const map = readFileSync(MAP, 'utf8').trim();
    const startup = context('startup');
    expect(startup).toContain(map);

    const resume = context('resume');
    expect(resume).toContain('clinozy-fe session ready');
    expect(resume).not.toContain(map);
    expect(resume).toContain('already earlier in this conversation');
    expect(resume.length).toBeLessThan(startup.length / 10);
  });

  it('a local session leaves the dev server to the developer', () => {
    expect(context('startup')).toContain(
      '- Frontend: on demand (local session) — pnpm dev',
    );
  });

  it('a web session starts the dev server once, detached, beside the backend stack', () => {
    const hook = readFileSync(HOOK, 'utf8');
    expect(hook).toContain(
      "if (!isRemote) return 'on demand (local session) — pnpm dev';",
    );
    // Never twice: a dev server already serving the app shell (a resumed session) is left alone.
    expect(hook).toContain('if (await devServerServes()) return `live — ');
    expect(hook).toContain("(await response.text()).includes('/src/main.tsx')");
    // Its own session (setsid), on the port the API's CORS list names, not waited for.
    expect(hook).toMatch(
      /spawn\(\s*'pnpm',\s*\['dev', '--port', String\(DEV_SERVER_PORT\), '--strictPort'\],/,
    );
    expect(hook).toMatch(/detached: true,\s*stdio: \['ignore', log, log\],\s*\},\s*\);/);
    expect(hook).toContain('server.unref();');
    // Fail-open: no pnpm on PATH is reported, and a spawn that fails later cannot crash the hook.
    expect(hook).toContain(
      "if (!onPath('pnpm')) return 'not started (pnpm is not on PATH) — pnpm dev';",
    );
    expect(hook).toContain("server.on('error', () => {});");
    // The log and pid go only into a stack directory this user owns.
    expect(hook).toContain(
      'mkdirSync(stackDirectory, { recursive: true, mode: 0o700 });',
    );
    expect(hook).toContain('directory.uid !== process.getuid?.()');
    expect(hook).toContain("writeFileSync(join(stackDirectory, 'frontend.pid')");
  });

  it('a web session whose dev server cannot start still briefs and exits 0', () => {
    // The dependencies are there (a stub vite), and PATH is /usr/bin:/bin, which holds no pnpm
    // on most machines (corepack can put one there). :5173 may or may not answer here, so any
    // of the three answers passes; a crash does not.
    mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(join(root, 'node_modules', '.bin', 'vite'), '#!/bin/sh\n');
    chmodSync(join(root, 'node_modules', '.bin', 'vite'), 0o755);
    const result = spawnSync(process.execPath, [HOOK], {
      encoding: 'utf8',
      input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'resume' }),
      env: {
        PATH: '/usr/bin:/bin',
        HOME: root,
        CLAUDE_PROJECT_DIR: root,
        CLAUDE_CODE_REMOTE: 'true',
        AGENT_STACK_DIR: join(root, 'agent-stack'),
      },
    });
    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as {
      hookSpecificOutput: { additionalContext: string };
    };
    expect(output.hookSpecificOutput.additionalContext).toMatch(
      /- Frontend: (live|not started \(pnpm is not on PATH\)|starting in the background)/,
    );
  });

  it('bootstrap.sh probes a dev server that is already running instead of starting a second', () => {
    const bootstrap = readFileSync(
      join(process.cwd(), 'tooling', 'setup', 'agent', 'bootstrap.sh'),
      'utf8',
    );
    expect(bootstrap).toContain(
      `if [[ "\${running_shell}" == *'/src/main.tsx'* ]]; then`,
    );
    expect(bootstrap).toContain(
      'pnpm dev --port "${health_port}" --strictPort >"${app_log}" 2>&1 &',
    );
  });
});
