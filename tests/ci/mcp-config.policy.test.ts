/**
 * Policy: the committed MCP templates stay consistent (no drift between the files).
 *
 * - `.mcp.example.json` is the full agent set; `.mcp.default.json` is the default
 *   auto-start pair (fe-codegraph + fe-headroom). The pair must mirror its entries in the
 *   full set exactly, so deriving the default from a separate committed file cannot
 *   drift.
 * - Both templates are mirrored under `agent-os/mcp/` (the agent-os source of truth);
 *   the root file and its mirror must be equal.
 *
 * - H-7: every server runs a pinned version — a `uvx` package spec names `==<version>` (headroom
 *   and semgrep equal to tooling/setup/agent/tool-versions.sh), a `pnpm exec` binary comes from a
 *   devDependency (the lockfile pins it), and nothing names `@latest`, `npx` or an unpinned image.
 *
 * See CLAUDE.md (MCP servers) and agent-os/mcp/.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();

type McpServers = Record<string, Record<string, unknown>>;

function readMcpServers(relativePath: string): McpServers {
  const raw = readFileSync(join(PROJECT_ROOT, relativePath), 'utf-8');
  const parsed = JSON.parse(raw) as { mcpServers?: McpServers };
  return parsed.mcpServers ?? {};
}

const EXPECTED_DEFAULT_KEYS = ['fe-codegraph', 'fe-headroom'];

describe('MCP template consistency', () => {
  const fullSet = readMcpServers('.mcp.example.json');
  const defaultPair = readMcpServers('.mcp.default.json');

  it('mirrors .mcp.example.json under agent-os/mcp/', () => {
    expect(readMcpServers('agent-os/mcp/mcp.example.json')).toEqual(fullSet);
  });

  it('mirrors .mcp.default.json under agent-os/mcp/', () => {
    expect(readMcpServers('agent-os/mcp/mcp.default.json')).toEqual(defaultPair);
  });

  it('default pair is exactly fe-codegraph + fe-headroom', () => {
    expect(Object.keys(defaultPair).sort()).toEqual([...EXPECTED_DEFAULT_KEYS].sort());
  });

  it('every default-pair server is a subset of, and matches, the full set (no drift)', () => {
    for (const [key, definition] of Object.entries(defaultPair)) {
      expect(fullSet, `${key} missing from .mcp.example.json`).toHaveProperty(key);
      expect(definition, `${key} definition differs from .mcp.example.json`).toEqual(
        fullSet[key],
      );
    }
  });
});

/** The pinned value of `key` in tooling/setup/agent/tool-versions.sh. */
function toolVersion(key: string): string {
  const pins = readFileSync(
    join(PROJECT_ROOT, 'tooling/setup/agent/tool-versions.sh'),
    'utf-8',
  );
  return new RegExp(`^${key}=(\\S+)$`, 'm').exec(pins)?.[1] ?? '';
}

/** The binary each `pnpm exec` server runs → the devDependency that installs it. */
const PNPM_EXEC_PACKAGES: Readonly<Record<string, string>> = {
  codegraph: '@colbymchenry/codegraph',
  'context7-mcp': '@upstash/context7-mcp',
  shadcn: 'shadcn',
  'tailwindcss-server': 'tailwindcss-mcp-server',
};

describe('MCP servers run pinned versions (H-7)', () => {
  const templates = ['.mcp.example.json', '.mcp.default.json'];
  const devDependencies = (
    JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8')) as {
      devDependencies: Record<string, string>;
    }
  ).devDependencies;

  it.each(templates)('%s pins every uvx package spec to an exact version', (file) => {
    const servers = Object.entries(readMcpServers(file)).filter(
      ([, definition]) => definition.command === 'uvx',
    );
    expect(servers.length).toBeGreaterThan(0);
    for (const [name, definition] of servers) {
      const args = definition.args as string[];
      const spec = args[args.indexOf('--from') + 1] ?? '';
      expect(spec, name).toMatch(/^[\w.-]+(?:\[[\w,-]+\])?==\d+\.\d+\.\d+$/);
    }
  });

  it('runs headroom and semgrep at the tool-versions.sh pins', () => {
    const fullSet = readMcpServers('.mcp.example.json');
    expect(String(fullSet['fe-headroom']?.args ?? '')).toContain(
      `headroom-ai[mcp]==${toolVersion('HEADROOM_VERSION')}`,
    );
    expect(String(fullSet['fe-semgrep']?.args ?? '')).toContain(
      `semgrep==${toolVersion('SEMGREP_VERSION')}`,
    );
    expect(toolVersion('HEADROOM_VERSION')).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it.each(templates)('%s runs every pnpm exec server from a devDependency', (file) => {
    for (const [name, definition] of Object.entries(readMcpServers(file))) {
      if (definition.command !== 'pnpm') continue;
      const args = definition.args as string[];
      expect(args[0], name).toBe('exec');
      const binary = args[1] ?? '';
      const dependency = PNPM_EXEC_PACKAGES[binary];
      expect(dependency, `${name}: unknown binary ${binary}`).toBeDefined();
      expect(devDependencies, name).toHaveProperty(dependency ?? '');
    }
  });

  it.each(templates)(
    '%s names no floating version, npx launcher or unpinned image',
    (file) => {
      const raw = readFileSync(join(PROJECT_ROOT, file), 'utf-8');
      expect(raw).not.toMatch(/@latest\b/);
      expect(raw).not.toMatch(/"npx"/);
      for (const [name, definition] of Object.entries(readMcpServers(file))) {
        if (definition.command !== 'docker') continue;
        const image = (definition.args as string[]).find(
          (arg) => /[/:]/.test(arg) && !arg.startsWith('-'),
        );
        expect(image, name).toMatch(/@sha256:[0-9a-f]{64}$/);
      }
    },
  );
});
