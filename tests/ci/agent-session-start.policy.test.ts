import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
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

  it('a web session launches bootstrap.sh once, detached, as clinozy-be launches its own', () => {
    const hook = readFileSync(HOOK, 'utf8');
    expect(hook).toContain(
      "if (!isRemote) return 'on demand (local session) — pnpm dev';",
    );
    // Never twice: a dev server already serving the app shell (a resumed session), or a bring-up
    // holding the lock, is left alone.
    expect(hook).toContain('if (await devServerServes()) return `live — ');
    expect(hook).toContain("(await response.text()).includes('/src/main.tsx')");
    expect(hook).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a shell parameter expansion, asserted verbatim
      'source tooling/setup/agent/stack-lock.lib.sh && stack_lock_holder "${AGENT_STACK_DIR:-/tmp/agent-stack}/frontend"',
    );
    // AGENT_STACK_DIR reaches the lock check through the environment, never the command line.
    expect(hook).toContain("spawnSync('bash', ['-c', FRONTEND_LOCK_HOLDER_COMMAND]");
    // Its own session (setsid), its log in the stack directory, and not waited for.
    expect(hook).toMatch(
      /spawn\('bash', \['tooling\/setup\/agent\/bootstrap\.sh'\], \{\s*cwd: repositoryRoot,\s*detached: true,\s*stdio: \['ignore', log, log\],\s*\}\);/,
    );
    expect(hook).toContain("join(stackDirectory, 'bootstrap-frontend.log')");
    expect(hook).toContain('bringUp.unref();');
    // Fail-open: a spawn that fails later cannot crash the hook.
    expect(hook).toContain("bringUp.on('error', () => {});");
    // The log goes only into a stack directory this user owns.
    expect(hook).toContain(
      'mkdirSync(stackDirectory, { recursive: true, mode: 0o700 });',
    );
    expect(hook).toContain('directory.uid !== process.getuid?.()');
    // The hook starts nothing else: the dev server and SonarQube are bootstrap.sh's.
    expect(hook).not.toContain("'dev', '--port'");
    expect(hook).not.toContain('start-sonarqube.sh');
  });

  it('bootstrap.sh keeps the dev server running, then starts the agent tools and SonarQube', () => {
    const bootstrap = readFileSync(
      join(process.cwd(), 'tooling', 'setup', 'agent', 'bootstrap.sh'),
      'utf8',
    );
    // Its own session, on the port the API's CORS list names, health checked and left running.
    const devServer = bootstrap.indexOf(
      `start_detached frontend pnpm dev --port "\${DEV_SERVER_PORT}" --strictPort`,
    );
    expect(devServer).toBeGreaterThan(-1);
    expect(bootstrap).toContain('setsid nohup "$@"');
    const healthcheck = bootstrap.indexOf(
      `if ! HEALTHCHECK_URL="\${health_url}" bash "\${AGENT_DIR}/healthcheck.sh"; then`,
    );
    expect(healthcheck).toBeGreaterThan(devServer);
    expect(bootstrap).not.toContain('kill_tree');
    // After the dev server is live, in the background: the app needs neither.
    const tools = bootstrap.indexOf(
      `start_detached agent-tools-frontend bash "\${AGENT_DIR}/install-agent-tools.sh"`,
    );
    expect(tools).toBeGreaterThan(healthcheck);
    // The shared script waits for clinozy-be's bring-up lock to clear and Docker to answer, so
    // SonarQube's boot never competes with the migrations and the seed.
    expect(
      bootstrap.indexOf(
        `start_detached sonarqube-frontend bash "\${AGENT_DIR}/start-sonarqube.sh"`,
      ),
    ).toBeGreaterThan(healthcheck);
    const script = readFileSync('tooling/setup/agent/start-sonarqube.sh', 'utf8');
    expect(script).toContain('settle_seconds=30');
    expect(script).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: shell parameter expansions, asserted verbatim
      'while [ "${waited}" -lt "${settle_seconds}" ] || [ -d "${lock_directory}" ] || ! docker info',
    );
    expect(script).toContain(
      'docker compose -f docker-compose.sonar.yml up -d sonarqube',
    );
  });

  it('bootstrap.sh holds its own lock, apart from the one clinozy-be holds', () => {
    const bootstrap = readFileSync(
      join(process.cwd(), 'tooling', 'setup', 'agent', 'bootstrap.sh'),
      'utf8',
    );
    expect(bootstrap).toContain(`source "\${AGENT_DIR}/stack-lock.lib.sh"`);
    expect(bootstrap).toContain(`readonly LOCK_PARENT="\${STACK_DIR}/frontend"`);
    expect(bootstrap).toContain(
      `if lock_holder="$(stack_lock_holder "\${LOCK_PARENT}")"; then`,
    );
    expect(bootstrap).toContain(`stack_lock_write "\${LOCK_PARENT}"`);
    // start-sonarqube.sh waits on clinozy-be's lock alone: the frontend's never holds it up.
    expect(bootstrap).not.toContain(`"\${STACK_DIR}/lock"`);
  });

  it('a web session whose bring-up cannot start still briefs and exits 0', () => {
    // The dependencies are there (a stub vite), and the bare root holds no bootstrap.sh, so the
    // detached bring-up dies at once. :5173 may or may not answer here, so either answer passes;
    // a crash does not.
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
      /- Frontend: (live|starting in the background)/,
    );
  });

  it('bootstrap.sh probes a dev server that is already running instead of starting a second', () => {
    const bootstrap = readFileSync(
      join(process.cwd(), 'tooling', 'setup', 'agent', 'bootstrap.sh'),
      'utf8',
    );
    const probe = bootstrap.indexOf(
      `if [[ "\${running_shell}" == *'/src/main.tsx'* ]]; then`,
    );
    expect(probe).toBeGreaterThan(-1);
    expect(probe).toBeLessThan(bootstrap.indexOf('start_detached frontend pnpm dev'));
  });

  it('the dependency install runs only when Node or the lockfile changed', () => {
    const bootstrap = readFileSync(
      join(process.cwd(), 'tooling', 'setup', 'agent', 'bootstrap.sh'),
      'utf8',
    );
    expect(bootstrap).toContain('readonly STAMP_DIR="node_modules/.agent-stamps"');
    const inputs = bootstrap.slice(
      bootstrap.indexOf('dependency_inputs() {'),
      bootstrap.indexOf('dependency_stamp="$(hash_of dependency_inputs)"'),
    );
    expect(inputs).toContain('node -v');
    expect(inputs).toContain('pnpm-lock.yaml');
    // The stamp is written only after the install succeeded.
    expect(bootstrap.indexOf('pnpm install --frozen-lockfile >&2 || die')).toBeLessThan(
      bootstrap.indexOf(
        `printf '%s\\n' "\${dependency_stamp}" >"\${STAMP_DIR}/dependencies"`,
      ),
    );
  });

  it('every installer runs from bootstrap.sh, directly or through install-agent-tools.sh', () => {
    // bootstrap.sh is the one entry point, in the Setup script and in a session alike: an
    // installer that neither reaches would only ever run by hand.
    const directory = join(process.cwd(), 'tooling', 'setup', 'agent');
    const reached =
      readFileSync(join(directory, 'bootstrap.sh'), 'utf8') +
      readFileSync(join(directory, 'install-agent-tools.sh'), 'utf8');
    const installers = readdirSync(directory).filter((file) =>
      /^install-.+\.sh$/.test(file),
    );
    expect(installers).toContain('install-semgrep.sh');
    for (const installer of installers) {
      expect(reached, installer).toContain(`"\${AGENT_DIR}/${installer}"`);
    }
  });

  it('bootstrap.sh takes --install-only, the switch clinozy-be uses, and refuses any other option', () => {
    const bootstrap = readFileSync(
      join(process.cwd(), 'tooling', 'setup', 'agent', 'bootstrap.sh'),
      'utf8',
    );
    expect(bootstrap).toContain('--install-only) install_only=1 ;;');
    expect(bootstrap).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a shell parameter expansion, asserted verbatim
      'echo "✗ unknown option: ${argument} (only --install-only)" >&2',
    );
    // The Setup script must terminate: it ends before the dev server, which only a session starts.
    const setupOnly = bootstrap.slice(
      bootstrap.indexOf(`if [ "\${install_only}" = 1 ]; then\n  # 4) Docker`),
      bootstrap.indexOf('# 4) The dev server'),
    );
    expect(setupOnly).toContain('exit 0\nfi');
    expect(setupOnly).toContain(`bash "\${AGENT_DIR}/install-agent-tools.sh"`);
    // Docker is touched only there: in a session, a restart to apply the registry mirror would
    // take clinozy-be's Postgres and Redis down with it.
    expect(setupOnly).toContain(`bash "\${AGENT_DIR}/install-docker-images.sh"`);
    expect(bootstrap.match(/install-docker-images\.sh"/g)).toHaveLength(1);
  });

  it("the cached install calls bootstrap.sh --install-only itself, as clinozy-be's does", () => {
    // One entry point, at the path clinozy-be uses: Cursor's install runs the same line as the
    // environment's Setup script, and no wrapper stands in front of it (a wrapper called without
    // the flag once ran a session's bring-up inside the cached install).
    const environment = JSON.parse(
      readFileSync(
        join(process.cwd(), 'agent-os', 'cloud-environment', 'environment.json'),
        'utf8',
      ),
    ) as { install: string };
    expect(environment.install).toBe(
      'bash tooling/setup/agent/bootstrap.sh --install-only',
    );
    expect(
      existsSync(join(process.cwd(), 'agent-os', 'cloud-environment', 'install.sh')),
    ).toBe(false);
    // The documented Setup-script line for a session that holds both repositories.
    const guide = readFileSync(
      join(process.cwd(), 'agent-os', 'cloud-environment', 'agents-cloud.md'),
      'utf8',
    );
    expect(guide).toContain(
      'bash /home/user/clinozy-fe/tooling/setup/agent/bootstrap.sh --install-only',
    );
  });
});
