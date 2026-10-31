/**
 * Launcher for the sonarqube MCP server (`.mcp.json` → `fe-sonarqube`).
 *
 * The `mcp/sonarqube` image reads SONARQUBE_TOKEN and SONARQUBE_URL, but neither is in an
 * agent's environment: the local quality gate keeps its token in `.env.local` as SONAR_TOKEN
 * (minted by `pnpm sonar:scan`, see tooling/sonar/sonar-gate.mjs) and serves SonarQube on
 * the host at SONAR_HOST_URL (default http://localhost:9001). So the container started
 * with nothing and the MCP connection closed. This wrapper loads `.env.local` (a value
 * already in the shell wins), maps the two keys, and runs the container on the host
 * network: the server publishes its port on the host's loopback only
 * (docker-compose.sonar.yml), which `host.docker.internal` — the bridge gateway — does not
 * reach, so the container addresses the server by the URL the host uses.
 *
 * Environment overrides:
 *   SONARQUBE_TOKEN / SONARQUBE_URL  used as given when set (e.g. a remote SonarQube)
 */
import '../load-env-files.mjs';

import { spawn } from 'node:child_process';

const token = process.env.SONARQUBE_TOKEN || process.env.SONAR_TOKEN;
const hostUrl =
  process.env.SONARQUBE_URL || process.env.SONAR_HOST_URL || 'http://localhost:9001';

if (!token) {
  console.error(
    'sonarqube-mcp: no SonarQube token. Run `pnpm sonar:scan` once — it mints SONAR_TOKEN into ' +
      '.env.local — or set SONARQUBE_TOKEN.',
  );
  process.exit(1);
}

const child = spawn(
  'docker',
  [
    'run',
    '--init',
    '--rm',
    '-i',
    '--network',
    'host',
    '-e',
    'SONARQUBE_TOKEN',
    '-e',
    'SONARQUBE_URL',
    'mcp/sonarqube',
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, SONARQUBE_TOKEN: token, SONARQUBE_URL: hostUrl },
  },
);
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
