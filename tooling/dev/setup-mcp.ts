#!/usr/bin/env tsx
/**
 * `pnpm mcp:setup` — scaffold `.mcp.json` from committed templates.
 *
 *   pnpm mcp:setup              # all servers (on-demand integrations)
 *   pnpm mcp:setup <name>...    # only the named servers
 *   pnpm mcp:setup:default      # only codegraph + headroom (auto-start pair)
 *   pnpm mcp:setup --check      # dry run
 *   pnpm mcp:setup --list       # list template servers + status
 *
 * Existing entries are never overwritten. See `agent-os/docs/cursor-mcp-setup.md`.
 */
import {
  ensureDefaultMcpServers,
  ensureMcpServers,
  type EnsureResult,
  listMcpServers,
  MCP_CONFIG_PATH,
} from './mcp-config.js';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
} as const;

function printHelp(): void {
  process.stdout.write(
    `${ANSI.bold}pnpm mcp:setup${ANSI.reset} — scaffold .mcp.json from .mcp.example.json\n\n` +
      `  pnpm mcp:setup            scaffold ALL template servers (on-demand integrations)\n` +
      `  pnpm mcp:setup <name>...  scaffold only the named servers (e.g. stripe sentry)\n` +
      `  pnpm mcp:setup:default    scaffold only codegraph + headroom (auto-start pair)\n` +
      `  pnpm mcp:setup --default  same as mcp:setup:default\n` +
      `  pnpm mcp:setup --check    dry run: report what would change, no write\n` +
      `  pnpm mcp:setup --list     list template servers and .mcp.json status\n` +
      `  pnpm mcp:setup --help     show this help\n\n` +
      `Existing .mcp.json entries are never overwritten. On Claude Code web the live MCP\n` +
      `set is configured in the web UI, not this file.\n`,
  );
}

function printList(): void {
  process.stdout.write(`${ANSI.bold}MCP servers in .mcp.example.json${ANSI.reset}\n`);
  for (const { key, declared, isDefault } of listMcpServers()) {
    const mark = declared
      ? `${ANSI.green}✓ declared${ANSI.reset}`
      : `${ANSI.gray}· absent${ANSI.reset}`;
    const tag = isDefault ? ` ${ANSI.cyan}(default)${ANSI.reset}` : '';
    process.stdout.write(`  ${mark}  ${key}${tag}\n`);
  }
  process.stdout.write(
    `\n${ANSI.gray}default = auto-start pair (codegraph + headroom)${ANSI.reset}\n`,
  );
}

function reportResult(result: EnsureResult, dryRun: boolean): void {
  if (result.missingFromTemplate.length > 0) {
    process.stdout.write(
      `${ANSI.yellow}!${ANSI.reset} unknown server(s) ignored: ${result.missingFromTemplate.join(', ')} — run \`pnpm mcp:setup --list\` for valid names\n`,
    );
  }
  if (result.alreadyPresent.length > 0) {
    process.stdout.write(
      `${ANSI.gray}○ already declared: ${result.alreadyPresent.join(', ')}${ANSI.reset}\n`,
    );
  }
  if (!result.changed) {
    process.stdout.write(
      `${ANSI.green}✓${ANSI.reset} .mcp.json already up to date — nothing to do.\n`,
    );
    return;
  }
  const verb = dryRun ? 'would add' : 'added';
  process.stdout.write(
    `${ANSI.green}✓${ANSI.reset} ${verb}: ${result.added.join(', ')}\n`,
  );
  if (!dryRun)
    process.stdout.write(`${ANSI.gray}wrote ${MCP_CONFIG_PATH}${ANSI.reset}\n`);
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }
  if (argv.includes('--list')) {
    printList();
    return;
  }
  const dryRun = argv.includes('--check') || argv.includes('--dry-run');
  const names = argv.filter((arg) => !arg.startsWith('-'));
  const defaultOnly = names.length === 0 && argv.includes('--default');

  let scope = 'full set';
  if (names.length > 0) scope = `selected: ${names.join(', ')}`;
  else if (defaultOnly) scope = 'default pair (codegraph + headroom)';

  process.stdout.write(
    `${ANSI.bold}Scaffolding .mcp.json — ${scope}${dryRun ? ' (dry run)' : ''}${ANSI.reset}\n`,
  );
  try {
    let result: EnsureResult;
    if (names.length > 0) result = ensureMcpServers({ keys: names, dryRun });
    else if (defaultOnly) result = ensureDefaultMcpServers({ dryRun });
    else result = ensureMcpServers({ keys: 'all', dryRun });
    reportResult(result, dryRun);
  } catch (error) {
    process.stderr.write(
      `${ANSI.yellow}mcp:setup failed${ANSI.reset}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
}

main();
