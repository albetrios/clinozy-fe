import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { config } from 'zod';

describe('zod-jitless', () => {
  it('switches Zod to jitless, so it never probes `new Function` under the CSP', async () => {
    expect(config().jitless).not.toBe(true);
    await import('./zod-jitless.ts');
    expect(config().jitless).toBe(true);
  });

  it('rides in the zod chunk, which runs before any chunk that builds a schema', () => {
    // From main.tsx's body it would run too late: the chunks main imports — the
    // env schema among them — evaluate first, and build their schemas on the way.
    const viteConfig = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8');
    // Its `codeSplitting` group in vite.config.ts names it beside zod itself.
    expect(viteConfig).toMatch(
      /name: 'zod',\s*test: \(id\) =>\s*id\.includes\('node_modules\/zod'\)\s*\|\|\s*id\.endsWith\('\/src\/lib\/zod-jitless\.ts'\)/,
    );
  });
});
