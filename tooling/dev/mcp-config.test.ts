/**
 * Policy: MCP templates stay consistent (no drift between root and agent-os/mcp mirrors).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = process.cwd();
const EXPECTED_DEFAULT_KEYS = ['codegraph', 'headroom'];

function readMcpServers(relativePath) {
  const raw = readFileSync(join(PROJECT_ROOT, relativePath), 'utf8');
  const parsed = JSON.parse(raw);
  return parsed.mcpServers ?? {};
}

describe('MCP template consistency', () => {
  const fullSet = readMcpServers('.mcp.example.json');
  const defaultPair = readMcpServers('.mcp.default.json');

  it('mirrors .mcp.example.json under agent-os/mcp/', () => {
    assert.deepEqual(readMcpServers('agent-os/mcp/mcp.example.json'), fullSet);
  });

  it('mirrors .mcp.default.json under agent-os/mcp/', () => {
    assert.deepEqual(readMcpServers('agent-os/mcp/mcp.default.json'), defaultPair);
  });

  it('default pair is exactly codegraph + headroom', () => {
    assert.deepEqual(Object.keys(defaultPair).sort(), [...EXPECTED_DEFAULT_KEYS].sort());
  });

  it('every default-pair server matches its full-set definition (no drift)', () => {
    for (const [key, definition] of Object.entries(defaultPair)) {
      assert.ok(key in fullSet, `${key} missing from .mcp.example.json`);
      assert.deepEqual(
        definition,
        fullSet[key],
        `${key} definition differs from .mcp.example.json`,
      );
    }
  });
});
