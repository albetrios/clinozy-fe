import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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
const sessionStart = readFileSync('agent-os/hooks/fe-session-start.sh', 'utf8');

/** The guard's step 7, the staged secrets scan (the `step_7` function), as a script of its own. */
const secretsStep = guard.slice(
  guard.indexOf('# ── 7. Gitleaks secret scan'),
  guard.indexOf('# ── 8.'),
);

describe('git-hook gate tools', () => {
  it('stops the commit when gitleaks is missing', () => {
    // A PATH with only the base system directories: no gitleaks there.
    const result = spawnSync(
      '/bin/bash',
      ['-c', `set -e\n${secretsStep}\nstep_7\necho scanned`],
      {
        encoding: 'utf8',
        env: { PATH: '/usr/bin:/bin' },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('the staged secrets scan is mandatory');
    expect(result.stdout).not.toContain('scanned');
    expect(guard).not.toMatch(/Skipping secret scan/i);
  });

  it('a web session without gitleaks installs it at session start', () => {
    expect(sessionStart).toContain('bash tooling/setup/agent/install-gitleaks.sh');
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
