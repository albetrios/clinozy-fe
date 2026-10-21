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
          // A web session also starts the dev server: keep its log and pid inside this root.
          AGENT_STACK_DIR: join(root, 'agent-stack'),
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

  it('the Docker start waits on a service manager only when it started a dockerd', () => {
    // `service docker start` can return with no daemon behind it, and systemctl can start
    // nothing without systemd: a 30 s wait after each cost a cold start about 60 s.
    const daemonScript = readFileSync(
      'tooling/setup/agent/ensure-docker-daemon.sh',
      'utf8',
    );
    expect(daemonScript).toContain('dockerd_appeared() {');
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a shell parameter expansion, asserted verbatim
    expect(daemonScript).toContain('"${DOCKERD_APPEAR_SECONDS:-5}"');
    expect(daemonScript).toContain(
      'if dockerd_appeared; then\n    wait_for_docker || true\n  else\n    log "service docker start left no dockerd running; moving on."',
    );
    expect(daemonScript).toContain('[ -d /run/systemd/system ]');
    // Between the service attempts and the direct start, nothing waits on a daemon that no
    // process is starting.
    const serviceAttempts = daemonScript.slice(
      daemonScript.indexOf(
        'log "Docker daemon is not reachable; attempting to start it."',
      ),
      daemonScript.indexOf('  start_dockerd "directly"'),
    );
    expect(serviceAttempts.match(/wait_for_docker/g)).toHaveLength(2);
    expect(serviceAttempts.match(/dockerd_appeared/g)).toHaveLength(2);
  });

  it('the Docker start clears pid files left from before a pause, so a reused pid never blocks it', () => {
    // A resumed container keeps /var/run but no processes: dockerd's and containerd's pid files
    // named pids a kernel worker and a shell held after the reboot, and dockerd refused to start.
    const daemonScript = readFileSync(
      'tooling/setup/agent/ensure-docker-daemon.sh',
      'utf8',
    );
    expect(daemonScript).toContain('clear_stale_pid_file /var/run/docker.pid dockerd');
    expect(daemonScript).toContain(
      'clear_stale_pid_file /var/run/docker/containerd/containerd.pid containerd',
    );
    // Stale means the pid does not run the program the file belongs to.
    expect(daemonScript).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a shell parameter expansion, asserted verbatim
      '[ "$(ps -p "${pid}" -o comm= 2>/dev/null)" = "$2" ]',
    );
    const start = daemonScript.slice(
      daemonScript.indexOf('start_dockerd() {'),
      daemonScript.indexOf('stop_dockerd() {'),
    );
    expect(start.indexOf('clear_stale_pid_files')).toBeGreaterThan(-1);
    expect(start.indexOf('clear_stale_pid_files')).toBeLessThan(start.indexOf('setsid'));
    // The service script starts dockerd with the same pid file, so it is cleared before that too.
    expect(daemonScript.indexOf('dockerd_running || clear_stale_pid_files')).toBeLessThan(
      daemonScript.indexOf('service docker start >/dev/null'),
    );
  });

  it('the Docker start never runs a second dockerd beside one still starting or stopping', () => {
    // The same script as clinozy-be's: a dockerd still alive has not failed, and a second one
    // stops on its pid file while the first, answering later, was recorded as the fallback.
    const daemonScript = readFileSync(
      'tooling/setup/agent/ensure-docker-daemon.sh',
      'utf8',
    );
    expect(daemonScript).toContain('pgrep -x dockerd');
    expect(daemonScript).toContain(
      'if ! docker info >/dev/null 2>&1 && command -v dockerd >/dev/null 2>&1 && ! dockerd_running; then',
    );
    expect(daemonScript).toContain(
      'if command -v dockerd >/dev/null 2>&1 && ! dockerd_running; then\n  start_restricted_dockerd',
    );
    expect(daemonScript).toContain(
      'log "Docker daemon is reachable after a slow start."',
    );
    // Stopping waits for the process to exit, not for the API to stop answering.
    const stop = daemonScript.slice(
      daemonScript.indexOf('stop_dockerd() {'),
      daemonScript.indexOf('probe_docker_layer_extract() {'),
    );
    expect(stop).toContain('dockerd_running || return 0');
    expect(stop).not.toContain('docker info');
  });
});
