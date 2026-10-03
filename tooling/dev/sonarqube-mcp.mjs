/**
 * Launcher for the sonarqube MCP server (`.mcp.json` → `sonarqube`).
 *
 * The `mcp/sonarqube` image reads SONARQUBE_TOKEN and SONARQUBE_URL, but neither is in an
 * agent's environment: the local quality gate keeps its token in `.env.local` as SONAR_TOKEN
 * (minted by `pnpm sonar:scan`, see tooling/sonar/sonar-gate.mjs) and serves SonarQube on
 * the host at SONAR_HOST_URL (default http://localhost:9001). So the container started
 * with nothing and the MCP connection closed. This wrapper loads `.env.local` (a value
 * already in the shell wins), maps the two keys, and rewrites a `localhost` URL to
 * `host.docker.internal` — inside the container, `localhost` is the container itself.
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

/** The host's SonarQube as the container must address it. */
const containerUrl = hostUrl.replace(
  /^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/,
  '$1host.docker.internal',
);

const child = spawn(
  'docker',
  [
    'run',
    '--init',
    '--rm',
    '-i',
    '-e',
    'SONARQUBE_TOKEN',
    '-e',
    'SONARQUBE_URL',
    'mcp/sonarqube',
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, SONARQUBE_TOKEN: token, SONARQUBE_URL: containerUrl },
  },
);
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
