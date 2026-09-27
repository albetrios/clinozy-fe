/**
 * Launcher for the chrome-devtools MCP server (`.mcp.json` → `chrome-devtools`).
 *
 * chrome-devtools-mcp needs a Chrome binary. Instead of requiring a system-wide
 * Chrome (cloud Linux VMs have none, and installs must stay project-scoped), this
 * wrapper points it at the Playwright-managed Chromium the E2E suite already uses —
 * one `pnpm exec playwright install --with-deps chromium` provisions both.
 *
 * Environment overrides:
 *   CHROME_DEVTOOLS_MCP_EXECUTABLE  explicit Chrome/Chromium binary path
 *   CHROME_DEVTOOLS_MCP_HEADED=1    run headed (default is headless — cloud VMs
 *                                   have no display; traces work either way)
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

import { chromium } from '@playwright/test';

const executablePath =
  process.env.CHROME_DEVTOOLS_MCP_EXECUTABLE ?? chromium.executablePath();

if (!existsSync(executablePath)) {
  console.error(
    `chrome-devtools-mcp: Chromium not found at ${executablePath}.\n` +
      'Install it with: pnpm exec playwright install --with-deps chromium',
  );
  process.exit(1);
}

const args = [
  'exec',
  'chrome-devtools-mcp',
  '--isolated',
  `--executablePath=${executablePath}`,
];
if (process.env.CHROME_DEVTOOLS_MCP_HEADED !== '1') args.push('--headless');
// Root has no usable Chrome sandbox (typical for cloud/container VMs).
if (typeof process.getuid === 'function' && process.getuid() === 0) {
  args.push('--chromeArg=--no-sandbox', '--chromeArg=--disable-setuid-sandbox');
}

const child = spawn('pnpm', args, { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
