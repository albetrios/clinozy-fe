import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { cssCurve, MOTION_CURVES } from './motion-curves.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const stylesheet = readFileSync(join(root, 'src/index.css'), 'utf8');

describe('MOTION_CURVES', () => {
  it.each([
    ['outStrong', '--ease-out-strong'],
    ['inOutStrong', '--ease-in-out-strong'],
    ['sheet', '--ease-sheet'],
  ] as const)('%s is the same curve as %s in index.css', (curve, token) => {
    expect(stylesheet).toContain(`${token}: ${cssCurve(curve)};`);
  });

  it('writes a curve as CSS does', () => {
    expect(cssCurve('outStrong')).toBe('cubic-bezier(0.23, 1, 0.32, 1)');
    expect(MOTION_CURVES.inOutStrong).toEqual([0.77, 0, 0.175, 1]);
  });
});
