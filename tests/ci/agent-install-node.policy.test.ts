import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

// The SessionStart hook's PATH switch never reaches a session that loads no hooks
// (one that holds both repos), so install-node.sh links the pinned toolchain into
// ~/.local/bin, which the cloud image puts ahead of its own /opt/node22/bin.
// Mirrors clinozy-be src/tests/unit/tooling/agent-install-node.unit.test.ts.

const PINNED_VERSION = readFileSync(join(process.cwd(), '.nvmrc'), 'utf8').trim();
const PINNED_MAJOR = PINNED_VERSION.split('.')[0] ?? '';
const LINKED_TOOLS = ['node', 'npm', 'npx', 'corepack', 'pnpm', 'pnpx'];

const temporaryDirectories: string[] = [];

/** Writes stand-in executables for a Node toolchain; `node` prints the given version. */
function writeFakeToolchain({
  directory,
  version,
}: {
  directory: string;
  version: string;
}): void {
  mkdirSync(directory, { recursive: true });
  for (const tool of LINKED_TOOLS) {
    const body = tool === 'node' ? `echo v${version}` : 'exit 0';
    writeFileSync(join(directory, tool), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  }
}

/** Runs install-node.sh with the pinned Node already on disk, so nothing is downloaded. */
function runInstaller({
  firstOnPath,
  linkUserBin,
}: {
  firstOnPath: 'image' | 'elsewhere';
  linkUserBin?: string;
}) {
  const root = mkdtempSync(join(tmpdir(), 'install-node-'));
  temporaryDirectories.push(root);
  const prefix = join(root, 'opt');
  const home = join(root, 'home');
  writeFakeToolchain({
    directory: join(prefix, `node${PINNED_MAJOR}`, 'bin'),
    version: PINNED_VERSION,
  });
  writeFakeToolchain({ directory: join(prefix, 'node22', 'bin'), version: '22.22.0' });
  writeFakeToolchain({ directory: join(root, 'nvm', 'bin'), version: '22.22.0' });
  const nodeDirectory =
    firstOnPath === 'image' ? join(prefix, 'node22', 'bin') : join(root, 'nvm', 'bin');
  const result = spawnSync('/bin/bash', ['tooling/setup/agent/install-node.sh'], {
    encoding: 'utf8',
    env: {
      PATH: `${nodeDirectory}:/usr/bin:/bin`,
      HOME: home,
      NODE_INSTALL_PREFIX: prefix,
      ...(linkUserBin === undefined ? {} : { NODE_LINK_USER_BIN: linkUserBin }),
    },
  });
  return { result, prefix, userBin: join(home, '.local', 'bin') };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe.runIf(process.platform === 'linux')(
  'install-node.sh links the pinned toolchain',
  () => {
    it('links every tool into ~/.local/bin when the node on PATH is the image Node', () => {
      const { result, prefix, userBin } = runInstaller({ firstOnPath: 'image' });
      expect(result.status).toBe(0);
      const pinnedBin = join(prefix, `node${PINNED_MAJOR}`, 'bin');
      for (const tool of LINKED_TOOLS) {
        expect(readlinkSync(join(userBin, tool))).toBe(join(pinnedBin, tool));
      }
    });

    it('links nothing when switched off with NODE_LINK_USER_BIN=0', () => {
      const { result, userBin } = runInstaller({
        firstOnPath: 'image',
        linkUserBin: '0',
      });
      expect(result.status).toBe(0);
      expect(existsSync(join(userBin, 'node'))).toBe(false);
    });

    it('leaves a Node from anywhere else (nvm, a system install) alone', () => {
      const { result, userBin } = runInstaller({ firstOnPath: 'elsewhere' });
      expect(result.status).toBe(0);
      expect(result.stderr).toContain('not the image layout');
      expect(existsSync(join(userBin, 'node'))).toBe(false);
    });
  },
);
