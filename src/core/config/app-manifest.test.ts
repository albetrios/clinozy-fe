import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildWebManifest } from './app-manifest.ts';

const MANIFEST_PATH = path.join(process.cwd(), 'public', 'manifest.webmanifest');

describe('app-manifest', () => {
  it('matches public/manifest.webmanifest (preset-aligned drift guard)', () => {
    const onDisk = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ReturnType<
      typeof buildWebManifest
    >;

    expect(onDisk).toEqual(buildWebManifest());
  });

  it('uses default preset shell colors and Boxes icon paths', () => {
    const manifest = buildWebManifest();
    expect(manifest.theme_color).toBe('#0a0a0a');
    expect(manifest.background_color).toBe('#ffffff');
    expect(manifest.icons.map((i) => i.src)).toContain('/app-icon.svg');
  });
});
