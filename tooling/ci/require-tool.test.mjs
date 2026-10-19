import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requireTool, toolInstallHint } from './require-tool.mjs';

let binDirectory = '';
let originalPath;

beforeEach(() => {
  binDirectory = mkdtempSync(join(tmpdir(), 'require-tool-'));
  originalPath = process.env.PATH;
  // Only the fake tools below are on PATH, so a real install never answers for them.
  process.env.PATH = binDirectory;
});

afterEach(() => {
  process.env.PATH = originalPath;
  rmSync(binDirectory, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function installFake(name) {
  const path = join(binDirectory, name);
  writeFileSync(path, '#!/bin/sh\necho "fake 1.0.0"\n');
  chmodSync(path, 0o755);
}

describe('requireTool', () => {
  it('answers true, silently, when the tool runs', () => {
    installFake('gitleaks');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(requireTool({ name: 'gitleaks', mode: 'block', purpose: 'the scan' })).toBe(
      true,
    );
    expect(error).not.toHaveBeenCalled();
  });

  it('blocks a missing tool with what it was for and its installer', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(
      requireTool({
        name: 'gitleaks',
        mode: 'block',
        purpose: 'the staged secrets scan',
      }),
    ).toBe(false);
    expect(error).toHaveBeenCalledWith(
      `✖ gitleaks is not installed — the staged secrets scan cannot run. Install: ${toolInstallHint('gitleaks')}`,
    );
  });

  it('warns about a missing tool when the step can be skipped', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(
      requireTool({ name: 'semgrep', mode: 'warn', purpose: 'Semgrep at push' }),
    ).toBe(false);
    expect(error).toHaveBeenCalledWith(
      `⚠ semgrep is not installed — Semgrep at push skipped. Install: ${toolInstallHint('semgrep')}`,
    );
  });

  it('names an installer script that exists', () => {
    for (const name of ['docker', 'gitleaks', 'semgrep']) {
      const script = /bash (\S+)/.exec(toolInstallHint(name))?.[1] ?? '';
      expect(existsSync(join(process.cwd(), script)), script).toBe(true);
    }
  });
});
