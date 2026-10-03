import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const css = readFileSync(join(root, 'src/index.css'), 'utf8');

describe('the dark variant', () => {
  it('follows the app’s `.dark` class, not the operating system', () => {
    // Without this, Tailwind v4's `dark:` is `@media (prefers-color-scheme: dark)`:
    // the shadcn primitives drew dark tints on a light app under a dark OS.
    expect(css).toMatch(/@custom-variant dark \(&:where\(\.dark, \.dark \*\)\);/);
  });
});
