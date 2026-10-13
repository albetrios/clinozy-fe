import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { Plugin } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MINIMUM_SUPPORTED_VERSION } from '../../src/core/version/minimum-version.constants.ts';
import { compareReleaseVersions } from '../../src/lib/app-version.ts';

/**
 * The critical-update floor (`src/core/version/minimum-version.constants.ts`). Every
 * tab running a release below it counts down and reloads, whatever the user is doing —
 * so a wrong value is either a silent no-op or a fleet-wide forced reload. These checks
 * pin the value's shape, the build wiring that carries it into `version.json`, and the
 * one-way flow: the build writes it, the running app reads only the deployed copy.
 */
const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const released = (
  JSON.parse(read('.github/release-please/manifest.json')) as { '.': string }
)['.'];

/** The lowest version the next release can carry: the current release, patch-bumped. */
function nextPatch(version: string): string {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${(patch ?? 0) + 1}`;
}

/** Why `floor` is not a safe value while `released` is the current release; null when it is. */
function floorProblem(floor: string | null, current: string): string | null {
  if (floor === null) return null;
  if (compareReleaseVersions(floor, floor) === null) {
    return `"${floor}" is not a release version (major.minor.patch)`;
  }
  const ceiling = nextPatch(current);
  const order = compareReleaseVersions(floor, ceiling);
  if (order === null || order > 0) {
    return `"${floor}" is above ${ceiling}, the lowest version the next release can carry — set it to ${ceiling} so the release that ships the fix meets its own floor`;
  }
  return null;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

describe('critical-update floor (MINIMUM_SUPPORTED_VERSION)', () => {
  it('is null, or a release version the next release is sure to meet', () => {
    expect(floorProblem(MINIMUM_SUPPORTED_VERSION, released)).toBeNull();
  });

  // Proves the check above can fail — a guard that never fires guards nothing.
  it('rejects the values that would break it', () => {
    expect(floorProblem('v1.12.1', '1.12.0')).toMatch(/not a release version/);
    expect(floorProblem('1.12', '1.12.0')).toMatch(/not a release version/);
    expect(floorProblem('1.13.0', '1.12.0')).toMatch(/set it to 1\.12\.1/);
    expect(floorProblem('1.12.1', '1.12.0')).toBeNull(); // the documented value
    expect(floorProblem('1.12.0', '1.12.1')).toBeNull(); // an older floor, after its release
  });

  it('reaches the build: vite.config.ts hands the release version to version-json', () => {
    expect(read('vite.config.ts')).toContain(
      'versionJson(buildId, { version: env.VITE_APP_VERSION })',
    );
  });

  it('reaches the release version: deploys bake VITE_APP_VERSION from the release-please manifest', () => {
    for (const workflow of [
      '.github/workflows/reusable-netlify-deploy.yml',
      '.github/workflows/preview.yml',
    ]) {
      const text = read(workflow);
      expect(text, workflow).toContain('.github/release-please/manifest.json');
      expect(text, workflow).toContain(
        'VITE_APP_VERSION: ${{ steps.version.outputs.vite_app_version }}',
      );
    }
  });

  it('is never read by the running app — only the deployed version.json is', () => {
    const importers = sourceFiles(join(ROOT, 'src'))
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter((file) =>
        /from ['"][^'"]*minimum-version\.constants/.test(readFileSync(file, 'utf8')),
      )
      .map((file) => relative(ROOT, file));
    expect(importers).toEqual([]);
  });
});

describe('version.json (plugins/version-json.ts)', () => {
  afterEach(() => {
    vi.doUnmock('../../src/core/version/minimum-version.constants.ts');
    vi.resetModules();
  });

  /** The version.json a build with this floor and release version serves. */
  async function versionJsonWith(
    floor: string | null,
    version: string | undefined,
  ): Promise<Record<string, unknown>> {
    vi.resetModules();
    vi.doMock('../../src/core/version/minimum-version.constants.ts', () => ({
      MINIMUM_SUPPORTED_VERSION: floor,
    }));
    const { versionJson } = await import('../../plugins/version-json.ts');
    const plugin = versionJson('build-probe', { version });
    let handler: ((req: unknown, res: unknown, next: () => void) => void) | undefined;
    (plugin.configureServer as (server: unknown) => void)({
      middlewares: { use: (fn: typeof handler) => (handler = fn) },
    });
    let body = '';
    handler?.(
      { url: '/version.json' },
      { setHeader: () => undefined, end: (text: string) => (body = text) },
      () => undefined,
    );
    return JSON.parse(body) as Record<string, unknown>;
  }

  it('carries the build id and release version, and no floor while none is set', async () => {
    const served = await versionJsonWith(null, '1.12.0');
    expect(served).toMatchObject({ buildId: 'build-probe', version: '1.12.0' });
    expect(served).not.toHaveProperty('minimumVersion');
  });

  it('advertises the floor from the release that meets it', async () => {
    expect(await versionJsonWith('1.12.1', '1.12.1')).toMatchObject({
      version: '1.12.1',
      minimumVersion: '1.12.1',
    });
  });

  it('holds the floor back on trunk builds still carrying the previous release', async () => {
    expect(await versionJsonWith('1.12.1', '1.12.0')).not.toHaveProperty(
      'minimumVersion',
    );
  });

  it('omits both on a local build with no release version', async () => {
    const served = await versionJsonWith('1.12.1', '');
    expect(served).not.toHaveProperty('version');
    expect(served).not.toHaveProperty('minimumVersion');
  });

  it('fails the build on a floor that is not a release version', async () => {
    vi.doMock('../../src/core/version/minimum-version.constants.ts', () => ({
      MINIMUM_SUPPORTED_VERSION: 'v1.12.1',
    }));
    const { versionJson } = await import('../../plugins/version-json.ts');
    expect(() => versionJson('build-probe', { version: '1.12.1' }) as Plugin).toThrow(
      /not a release version/,
    );
  });
});
