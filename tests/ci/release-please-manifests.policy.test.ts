import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const RELEASE_PLEASE_DIR = join(process.cwd(), '.github/release-please');

interface ReleasePleaseConfig {
  draft?: boolean;
  prerelease?: boolean;
  'prerelease-type'?: string;
  versioning?: string;
}

interface ReleasePleaseManifest {
  '.': string;
}

function readJson<TValue>(relativePath: string): TValue {
  return JSON.parse(
    readFileSync(join(RELEASE_PLEASE_DIR, relativePath), 'utf8'),
  ) as TValue;
}

// Single stable release channel: the config/manifest publish plain
// MAJOR.MINOR.PATCH versions immediately, with no prerelease or draft mode.
describe('release-please manifest policy (single channel)', () => {
  it('stable config keeps prerelease mode disabled', () => {
    const config = readJson<ReleasePleaseConfig>('config.json');
    expect(config.prerelease ?? false).toBe(false);
    expect(config['prerelease-type']).toBeUndefined();
  });

  it('stable config publishes releases immediately so release-please does not re-count draft releases', () => {
    const config = readJson<ReleasePleaseConfig>('config.json');
    expect(config.draft ?? false).toBe(false);
  });

  it('stable manifest version is plain MAJOR.MINOR.PATCH', () => {
    const manifest = readJson<ReleasePleaseManifest>('manifest.json');
    expect(manifest['.']).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
