/**
 * Policy: MCP templates stay consistent (no drift between root and agent-os/mcp mirrors).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { renamePreviousServerKeys } from './mcp-config.js';

const PROJECT_ROOT = process.cwd();
const EXPECTED_DEFAULT_KEYS = ['fe-codegraph', 'fe-headroom'];

function readMcpServers(relativePath) {
  const raw = readFileSync(join(PROJECT_ROOT, relativePath), 'utf8');
  const parsed = JSON.parse(raw);
  return parsed.mcpServers ?? {};
}

describe('MCP template consistency', () => {
  const fullSet = readMcpServers('.mcp.example.json');
  const defaultPair = readMcpServers('.mcp.default.json');

  it('mirrors .mcp.example.json under agent-os/mcp/', () => {
    expect(readMcpServers('agent-os/mcp/mcp.example.json')).toStrictEqual(fullSet);
  });

  it('mirrors .mcp.default.json under agent-os/mcp/', () => {
    expect(readMcpServers('agent-os/mcp/mcp.default.json')).toStrictEqual(defaultPair);
  });

  it('default pair is exactly fe-codegraph + fe-headroom', () => {
    expect(Object.keys(defaultPair).sort()).toStrictEqual(
      [...EXPECTED_DEFAULT_KEYS].sort(),
    );
  });

  it('every default-pair server matches its full-set definition (no drift)', () => {
    for (const [key, definition] of Object.entries(defaultPair)) {
      expect(key in fullSet, `${key} missing from .mcp.example.json`).toBeTruthy();
      expect(
        definition,
        `${key} definition differs from .mcp.example.json`,
      ).toStrictEqual(fullSet[key]);
    }
  });
});

describe('server keys used before the fe- prefix', () => {
  it('renames a previous key in place, keeping its definition', () => {
    const { servers, renamed } = renamePreviousServerKeys({
      codegraph: { command: 'previous' },
      shadcn: { command: 'pnpm' },
    });
    expect({ ...servers }).toStrictEqual({
      'fe-codegraph': { command: 'previous' },
      shadcn: { command: 'pnpm' },
    });
    expect(renamed).toStrictEqual(['codegraph → fe-codegraph']);
  });

  it('drops the previous key when the current one is already declared', () => {
    const { servers, renamed } = renamePreviousServerKeys({
      headroom: { command: 'previous' },
      'fe-headroom': { command: 'current' },
    });
    expect({ ...servers }).toStrictEqual({ 'fe-headroom': { command: 'current' } });
    expect(renamed).toStrictEqual(['headroom → fe-headroom']);
  });

  it('leaves a config without previous keys as it is', () => {
    const { servers, renamed } = renamePreviousServerKeys({
      'fe-semgrep': { command: 'uvx' },
    });
    expect({ ...servers }).toStrictEqual({ 'fe-semgrep': { command: 'uvx' } });
    expect(renamed).toStrictEqual([]);
  });
});
