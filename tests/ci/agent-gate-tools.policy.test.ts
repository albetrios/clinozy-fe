import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The tools the git hooks' gates need are always there in a cloud session: the staged gitleaks
// scan is mandatory (it used to skip when gitleaks was missing), and the pre-push SonarQube gate
// starts Docker itself and finds its images already cached. clinozy-be pins the same in
// src/tests/unit/tooling/agent-sonar-docker.policy.unit.test.ts.

const guard = readFileSync('tooling/validate/before-commit-guard.sh', 'utf8');
const bootstrap = readFileSync('tooling/setup/agent/bootstrap.sh', 'utf8');
const installImages = readFileSync(
  'tooling/setup/agent/install-docker-images.sh',
  'utf8',
);
const sonarCompose = readFileSync('docker-compose.sonar.yml', 'utf8');
const sonarGate = readFileSync('tooling/sonar/sonar-gate.mjs', 'utf8');
const SESSION_START = join(process.cwd(), 'agent-os', 'hooks', 'fe-session-start.mjs');

/** The guard's step 7, the staged secrets scan (the `step_7` function), as a script of its own. */
const secretsStep = guard.slice(
  guard.indexOf('# ── 7. Gitleaks secret scan'),
  guard.indexOf('# ── 8.'),
);

describe('git-hook gate tools', () => {
  it('stops the commit when gitleaks is missing', () => {
    // A PATH with node (the shared tool check runs on it) and the base system directories only:
    // no gitleaks there.
    const nodeOnly = mkdtempSync(join(tmpdir(), 'fe-gate-tools-'));
    symlinkSync(process.execPath, join(nodeOnly, 'node'));
    try {
      const result = spawnSync(
        '/bin/bash',
        ['-c', `set -e\n${secretsStep}\nstep_7\necho scanned`],
        {
          encoding: 'utf8',
          env: { PATH: `${nodeOnly}:/usr/bin:/bin` },
        },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'gitleaks is not installed — the staged secrets scan cannot run',
      );
      expect(result.stderr).toContain('bash tooling/setup/agent/install-gitleaks.sh');
      expect(result.stdout).not.toContain('scanned');
      expect(guard).not.toMatch(/Skipping secret scan/i);
    } finally {
      rmSync(nodeOnly, { recursive: true, force: true });
    }
  });

  it("runs the staged scan with clinozy-be's flags, exactly", () => {
    expect(secretsStep).toContain(
      'gitleaks protect --staged --redact --verbose --config .gitleaks.toml\n',
    );
    expect(secretsStep.match(/gitleaks protect/g)).toHaveLength(1);
  });

  it('a web session without gitleaks installs it at session start', () => {
    // A bare project root with a stub installer that records it ran, the dependencies already
    // there (no pnpm install) and a PATH without gitleaks.
    const root = mkdtempSync(join(tmpdir(), 'fe-gate-tools-session-'));
    try {
      const marker = join(root, 'installer-ran');
      mkdirSync(join(root, 'tooling', 'setup', 'agent'), { recursive: true });
      writeFileSync(
        join(root, 'tooling', 'setup', 'agent', 'install-gitleaks.sh'),
        `touch "${marker}"\n`,
      );
      mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
      writeFileSync(join(root, 'node_modules', '.bin', 'vite'), '#!/bin/sh\n');
      chmodSync(join(root, 'node_modules', '.bin', 'vite'), 0o755);
      const result = spawnSync(process.execPath, [SESSION_START], {
        encoding: 'utf8',
        input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'resume' }),
        env: {
          PATH: '/usr/bin:/bin',
          HOME: root,
          CLAUDE_PROJECT_DIR: root,
          CLAUDE_CODE_REMOTE: 'true',
        },
      });
      expect(result.status).toBe(0);
      expect(existsSync(marker)).toBe(true);
      expect(result.stdout).toContain(
        'gitleaks install-failed (run: bash tooling/setup/agent/install-gitleaks.sh)',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('the Setup script starts Docker and pre-pulls the images the gate runs', () => {
    expect(bootstrap).toContain('bash "${AGENT_DIR}/install-docker-images.sh"');
    expect(installImages).toContain('bash "${agent_dir}/ensure-docker-daemon.sh"');
    expect(installImages).toContain(
      'docker compose -f docker-compose.sonar.yml pull sonarqube scanner',
    );
    // The pulled names must stay the compose file's service names.
    expect(sonarCompose).toMatch(/^ {2}sonarqube:$/m);
    expect(sonarCompose).toMatch(/^ {2}scanner:$/m);
  });

  it("pins the Compose project, so a worktree's push reuses the main checkout's server", () => {
    // Unpinned, the project was the folder name: a push from a worktree (20 Oct 2026) started a
    // second project and stopped on the main checkout's fixed `container_name`.
    const project = /^name: ([\w-]+)$/m.exec(sonarCompose)?.[1];
    expect(project).toBeDefined();
    expect(sonarCompose).toContain(`container_name: ${project}-sonarqube`);
    expect(sonarCompose).toContain(`container_name: ${project}-sonar-scanner`);
  });

  it('the Elasticsearch index is on tmpfs, clear of a disk that is under 10% free', () => {
    expect(sonarCompose).toContain(
      '- /opt/sonarqube/data/es8:size=2g,uid=1000,gid=0,mode=0770',
    );
    expect(sonarCompose).toContain('- sonarqube_data:/opt/sonarqube/data');
  });

  it('the gate starts a stopped Docker daemon before it starts SonarQube', () => {
    expect(sonarGate).toContain("'tooling/setup/agent/ensure-docker-daemon.sh'");
    const daemonStart = sonarGate.indexOf('  ensureDockerDaemon();');
    expect(daemonStart).toBeGreaterThan(-1);
    expect(daemonStart).toBeLessThan(
      sonarGate.indexOf("dockerCompose(['up', '-d', 'sonarqube'])"),
    );
  });
});
