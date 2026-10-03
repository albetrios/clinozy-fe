#!/usr/bin/env tsx
/**
 * `pnpm setup:local` — one-command local bootstrap for clinozy-fe.
 *
 * Idempotent: preflight (+ macOS external tools) → dependencies → env (.env.local) → MCP (full set) → optional dev.
 *
 * `.env.local` is the gitignored local env file (NODE_ENV=local; one `.env.<mode>`
 * per environment, mirroring clinozy-be); it holds behavior flags + machine secrets.
 * Deploys use GitHub Environments.
 *
 * Usage:
 *   pnpm setup:local
 *   pnpm setup:local --no-start          (bootstrap only, skip dev)
 *   pnpm setup:local --check             (preflight only, no mutations)
 *   pnpm setup:local --skip-deps
 *   pnpm setup:local --skip-mcp
 *   pnpm setup:local --skip-codegraph
 *   pnpm setup:local --skip-mac-tools    (skip the macOS external-tool install/upgrade)
 *   pnpm setup:local --only-env          (scaffold .env.local only, then exit)
 *   pnpm setup:local --force-env          (rewrite .env.local from .env.example)
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import { type AppEnvironment, envProfiles } from '../../src/core/config/env-schema.ts';
import {
  describeFilled,
  fillExternalCredentials,
  upsertEnvAssignment,
} from './external-credentials.ts';
import { ensureMcpServers } from './mcp-config.js';

const PROJECT_ROOT = process.cwd();
const REQUIRED_NODE_MAJOR = 24;
const DEFAULT_DEV_PORT = 5173;

type StepStatus = 'done' | 'skipped' | 'warning' | 'failed';

interface StepReport {
  phase: string;
  status: StepStatus;
  detail?: string;
  elapsedMs: number;
}

interface BootstrapOptions {
  check: boolean;
  noStart: boolean;
  skipDeps: boolean;
  skipMcp: boolean;
  skipCodegraph: boolean;
  skipMacTools: boolean;
  onlyEnv: boolean;
  forceEnvLocal: boolean;
}

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

function symbolForStatus(status: StepStatus): string {
  switch (status) {
    case 'done':
      return `${ANSI.green}✓${ANSI.reset}`;
    case 'skipped':
      return `${ANSI.gray}○${ANSI.reset}`;
    case 'warning':
      return `${ANSI.yellow}!${ANSI.reset}`;
    case 'failed':
      return `${ANSI.red}✗${ANSI.reset}`;
  }
}

function logInfo(message: string): void {
  process.stdout.write(`  ${message}\n`);
}

function logHeading(message: string): void {
  process.stdout.write(`\n${ANSI.bold}${ANSI.cyan}${message}${ANSI.reset}\n`);
}

function logBanner(): void {
  const line = '═'.repeat(58);
  process.stdout.write(`\n╔${line}╗\n`);
  process.stdout.write(
    `║  ${ANSI.bold}clinozy-fe — local bootstrap (pnpm setup:local)${ANSI.reset}            ║\n`,
  );
  process.stdout.write(`║  deps + .env.local + MCP + dev in one command      ║\n`);
  process.stdout.write(`╚${line}╝\n`);
}

function reportStep(
  reports: StepReport[],
  phase: string,
  status: StepStatus,
  startedAtMs: number,
  detail?: string,
): void {
  const elapsedMs = Math.round(performance.now() - startedAtMs);
  reports.push({ phase, status, elapsedMs, detail });
  const elapsedLabel = elapsedMs < 100 ? '' : `${ANSI.dim}(${elapsedMs}ms)${ANSI.reset}`;
  const detailLabel = detail ? ` ${ANSI.dim}— ${detail}${ANSI.reset}` : '';
  process.stdout.write(
    `  ${symbolForStatus(status)} ${phase}${detailLabel} ${elapsedLabel}\n`,
  );
}

function parseArgs(): BootstrapOptions {
  const argv = process.argv.slice(2);
  const has = (flag: string) => argv.includes(flag);
  return {
    check: has('--check'),
    noStart: has('--no-start'),
    skipDeps: has('--skip-deps'),
    skipMcp: has('--skip-mcp'),
    skipCodegraph: has('--skip-codegraph'),
    skipMacTools: has('--skip-mac-tools'),
    onlyEnv: has('--only-env'),
    forceEnvLocal: has('--force-env-local') || has('--force-env'),
  };
}

function captureCommand(
  command: string,
  args: readonly string[],
): {
  code: number;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function runCommand(command: string, args: readonly string[]): number {
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const tester = createServer()
      .once('error', () => resolvePromise(true))
      .once('listening', () => {
        tester.close(() => resolvePromise(false));
      })
      .listen(port, '127.0.0.1');
  });
}

function runPreflight(reports: StepReport[], options: BootstrapOptions): void {
  logHeading('1/5 Preflight');

  const nodeStartedAt = performance.now();
  const nodeMajor = Number(process.versions.node.split('.')[0] ?? 0);
  if (Number.isNaN(nodeMajor) || nodeMajor < REQUIRED_NODE_MAJOR) {
    reportStep(
      reports,
      `Node ${process.versions.node}`,
      'failed',
      nodeStartedAt,
      `requires Node >= ${REQUIRED_NODE_MAJOR} (.nvmrc)`,
    );
    process.exit(1);
  }
  reportStep(reports, `Node ${process.versions.node}`, 'done', nodeStartedAt);

  const pnpmStartedAt = performance.now();
  const pnpmVersion = captureCommand('pnpm', ['--version']);
  if (pnpmVersion.code !== 0) {
    reportStep(
      reports,
      'pnpm CLI',
      'failed',
      pnpmStartedAt,
      'pnpm not found — corepack enable && corepack prepare pnpm@latest --activate',
    );
    process.exit(1);
  }
  reportStep(reports, 'pnpm CLI', 'done', pnpmStartedAt, `v${pnpmVersion.stdout.trim()}`);

  // External tools (macOS only for now): install-or-upgrade Homebrew, Node, gitleaks,
  // gh, jq, uv, ripgrep, shellcheck, librsvg, and a headless docker runtime — all from
  // authenticated sources, non-interactively. Runs before the gh check so a fresh machine
  // has gh installed by the time that check runs. Idempotent + skippable (--skip-mac-tools).
  // The full tool list is data-driven from tooling/dev/setup-prerequisites-mac-tools.manifest.
  if (process.platform === 'darwin' && !options.skipMacTools) {
    const toolsStartedAt = performance.now();
    const toolsCode = runCommand('bash', [
      'tooling/dev/setup-mac-tools.sh',
      ...(options.check ? ['--check'] : []),
    ]);
    reportStep(
      reports,
      'External tools (macOS)',
      toolsCode === 0 ? 'done' : 'warning',
      toolsStartedAt,
      toolsCode === 0 ? undefined : 'some tools did not install/upgrade — see output',
    );
  }

  const ghStartedAt = performance.now();
  const gh = captureCommand('gh', ['--version']);
  reportStep(
    reports,
    'gh CLI',
    gh.code === 0 ? 'done' : 'warning',
    ghStartedAt,
    gh.code === 0 ? 'present' : 'optional — install for GitHub automation',
  );
}

function runInstallDependencies(reports: StepReport[], options: BootstrapOptions): void {
  logHeading('2/5 Dependencies');
  const startedAt = performance.now();
  if (options.skipDeps) {
    reportStep(reports, 'pnpm install', 'skipped', startedAt, '--skip-deps');
    return;
  }
  const nodeModulesPath = resolve(PROJECT_ROOT, 'node_modules');
  if (existsSync(nodeModulesPath) && statSync(nodeModulesPath).isDirectory()) {
    reportStep(
      reports,
      'pnpm install',
      'skipped',
      startedAt,
      'node_modules/ present (run pnpm install manually to refresh)',
    );
    return;
  }
  if (options.check) {
    reportStep(
      reports,
      'pnpm install',
      'skipped',
      startedAt,
      '--check mode (would install)',
    );
    return;
  }
  const code = runCommand('pnpm', ['install', '--frozen-lockfile']);
  if (code !== 0) {
    reportStep(
      reports,
      'pnpm install',
      'failed',
      startedAt,
      'pnpm install --frozen-lockfile failed',
    );
    process.exit(1);
  }
  reportStep(reports, 'pnpm install', 'done', startedAt);
}

/**
 * Inject an environment's defaults into scaffolded `.env.<env>` content, from
 * `envProfiles[env].defaults` (src/core/config/env-schema.ts) — the single source
 * of truth for each environment's defaults, so the scaffolder and schema can never
 * drift. `setup:local` uses `'local'`; `github:sync` scaffolds the deploy-env files from
 * their own profiles' `defaults` (tooling/setup/github/scaffold-env-files.mjs).
 */
function injectEnvDefaults(content: string, env: AppEnvironment): string {
  let updated = content;
  for (const [key, value] of Object.entries(envProfiles[env].defaults ?? {})) {
    updated = upsertEnvAssignment(updated, key, value);
  }
  return updated;
}

function runEnvScaffolding(reports: StepReport[], options: BootstrapOptions): void {
  logHeading('3/5 Environment (.env.local)');
  const startedAt = performance.now();
  const envLocalPath = resolve(PROJECT_ROOT, '.env.local');
  const developmentPath = resolve(PROJECT_ROOT, '.env.development');
  const development = existsSync(developmentPath)
    ? readFileSync(developmentPath, 'utf8')
    : '';
  const externalCredentials = envProfiles.local.externalCredentials ?? [];
  if (existsSync(envLocalPath) && !options.forceEnvLocal) {
    // Top up an existing file: fill the external credentials that are missing or blank,
    // never overwrite one already set. Key names and sources only — never values.
    const { content, filled } = fillExternalCredentials(
      readFileSync(envLocalPath, 'utf8'),
      development,
      externalCredentials,
      process.env,
    );
    if (filled.length === 0) {
      reportStep(
        reports,
        '.env.local',
        'skipped',
        startedAt,
        'present (use --force-env-local to rewrite)',
      );
    } else if (options.check) {
      reportStep(
        reports,
        '.env.local',
        'warning',
        startedAt,
        `--check mode (would fill external credentials: ${describeFilled(filled)})`,
      );
    } else {
      writeFileSync(envLocalPath, content);
      reportStep(
        reports,
        '.env.local',
        'done',
        startedAt,
        `present — filled external credentials: ${describeFilled(filled)}`,
      );
    }
    return;
  }
  if (options.check) {
    reportStep(
      reports,
      '.env.local',
      'warning',
      startedAt,
      '--check mode (would copy from .env.example)',
    );
    return;
  }
  const examplePath = resolve(PROJECT_ROOT, '.env.example');
  if (!existsSync(examplePath)) {
    reportStep(reports, '.env.local', 'failed', startedAt, '.env.example missing');
    process.exit(1);
  }
  const scaffold = injectEnvDefaults(readFileSync(examplePath, 'utf8'), 'local');
  const { content, filled } = fillExternalCredentials(
    scaffold,
    development,
    externalCredentials,
    process.env,
  );
  writeFileSync(envLocalPath, content);
  const credentialsNote =
    filled.length > 0 ? ` + external credentials ${describeFilled(filled)}` : '';
  reportStep(
    reports,
    '.env.local',
    'done',
    startedAt,
    `copied from .env.example + localhost defaults${credentialsNote} — set CONTEXT7_API_KEY for MCP`,
  );
}

function runCodeGraphSetup(reports: StepReport[], options: BootstrapOptions): void {
  const startedAt = performance.now();
  if (options.skipCodegraph) {
    reportStep(reports, 'codegraph', 'skipped', startedAt, '--skip-codegraph');
    return;
  }
  if (options.check) {
    reportStep(
      reports,
      'codegraph',
      'skipped',
      startedAt,
      '--check mode (would init index)',
    );
    return;
  }

  const databasePath = resolve(PROJECT_ROOT, '.codegraph/codegraph.db');
  if (existsSync(databasePath)) {
    const sync = captureCommand('pnpm', ['exec', 'codegraph', 'sync']);
    reportStep(
      reports,
      'codegraph',
      sync.code === 0 ? 'done' : 'warning',
      startedAt,
      sync.code === 0
        ? 'index refreshed (codegraph sync)'
        : 'codegraph sync failed (non-fatal)',
    );
    return;
  }

  const init = captureCommand('pnpm', ['exec', 'codegraph', 'init']);
  reportStep(
    reports,
    'codegraph',
    init.code === 0 ? 'done' : 'warning',
    startedAt,
    init.code === 0
      ? 'project indexed (.codegraph/)'
      : 'codegraph init failed — run `pnpm exec codegraph init` manually (non-fatal)',
  );
}

function ensureFullMcpConfig(reports: StepReport[], options: BootstrapOptions): void {
  const startedAt = performance.now();
  if (options.check) {
    reportStep(
      reports,
      '.mcp.json (full set)',
      'skipped',
      startedAt,
      '--check mode (would declare all template servers)',
    );
    return;
  }
  try {
    const result = ensureMcpServers({ keys: 'all' });
    const detail = result.changed
      ? `declared ${result.added.join(', ')}`
      : 'all template servers already declared';
    reportStep(reports, '.mcp.json (full set)', 'done', startedAt, detail);
  } catch (error) {
    reportStep(
      reports,
      '.mcp.json (full set)',
      'warning',
      startedAt,
      error instanceof Error ? error.message : 'failed to scaffold .mcp.json',
    );
  }
}

function runMcpSetup(reports: StepReport[], options: BootstrapOptions): void {
  logHeading('4/5 MCP servers (CodeGraph index + full template set)');
  if (options.skipMcp) {
    const startedAt = performance.now();
    reportStep(reports, 'mcp', 'skipped', startedAt, '--skip-mcp');
    return;
  }
  runCodeGraphSetup(reports, options);
  ensureFullMcpConfig(reports, options);
}

async function runDevServer(
  reports: StepReport[],
  options: BootstrapOptions,
): Promise<void> {
  logHeading('5/5 Dev server');
  const startedAt = performance.now();
  if (options.check) {
    reportStep(reports, 'dev', 'skipped', startedAt, '--check mode');
    return;
  }
  if (options.noStart) {
    reportStep(reports, 'dev', 'skipped', startedAt, '--no-start');
    return;
  }
  const inUse = await isPortInUse(DEFAULT_DEV_PORT);
  if (inUse) {
    reportStep(
      reports,
      'dev',
      'warning',
      startedAt,
      `port ${DEFAULT_DEV_PORT} already in use — dev may fail or attach unexpectedly`,
    );
  } else {
    reportStep(reports, 'dev', 'done', startedAt, `port ${DEFAULT_DEV_PORT} free`);
  }

  process.stdout.write(
    `\n${ANSI.bold}${ANSI.green}Ready — starting pnpm dev${ANSI.reset}\n`,
  );
  logInfo(`App           ${ANSI.cyan}http://localhost:${DEFAULT_DEV_PORT}${ANSI.reset}`);
  logInfo(
    `Backend API   ${ANSI.gray}Vite proxies /api → VITE_DEV_API_URL (default http://localhost:3000)${ANSI.reset}`,
  );
  logInfo(
    `MCP           ${ANSI.gray}full set in .mcp.json — set CONTEXT7_API_KEY in .env.local, reload Cursor${ANSI.reset}`,
  );
  process.stdout.write('\n');

  // eslint-disable-next-line sonarjs/no-os-command-from-path -- bootstrap invokes pnpm via corepack PATH
  const dev = spawn('pnpm', ['dev'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    detached: false,
  });

  await new Promise<void>((resolveExit) => {
    dev.on('exit', (code) => {
      process.exitCode = code ?? 0;
      resolveExit();
    });
  });
}

function printSummary(reports: StepReport[]): void {
  logHeading('Summary');
  const counts = { done: 0, skipped: 0, warning: 0, failed: 0 };
  let totalMs = 0;
  for (const r of reports) {
    counts[r.status] += 1;
    totalMs += r.elapsedMs;
  }
  logInfo(
    `${ANSI.green}${counts.done} done${ANSI.reset}  ·  ${ANSI.gray}${counts.skipped} skipped${ANSI.reset}  ·  ${ANSI.yellow}${counts.warning} warning${ANSI.reset}  ·  ${ANSI.red}${counts.failed} failed${ANSI.reset}  ·  total ${Math.round(totalMs)}ms`,
  );
  process.stdout.write('\n');
}

async function main(): Promise<void> {
  const options = parseArgs();
  const reports: StepReport[] = [];

  logBanner();
  if (options.check)
    logInfo(`${ANSI.yellow}--check mode: read-only, no mutations${ANSI.reset}`);

  if (options.onlyEnv) {
    runEnvScaffolding(reports, options);
    printSummary(reports);
    return;
  }

  runPreflight(reports, options);
  runInstallDependencies(reports, options);
  runEnvScaffolding(reports, options);
  runMcpSetup(reports, options);
  printSummary(reports);
  await runDevServer(reports, options);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `\n${ANSI.red}setup:local failed${ANSI.reset}: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
