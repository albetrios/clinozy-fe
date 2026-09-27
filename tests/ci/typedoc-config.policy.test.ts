import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Guards the API-docs generator (pnpm docs:api): the config stays valid, wired,
// and its entry points don't rot into deleted directories.
const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const typedoc = JSON.parse(read('typedoc.json')) as {
  entryPoints: string[];
  out: string;
};
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

describe('typedoc config policy', () => {
  it('docs:api script runs typedoc', () => {
    expect(pkg.scripts['docs:api']).toBe('typedoc');
  });

  it('every entryPoint exists on disk', () => {
    for (const entry of typedoc.entryPoints) {
      expect(existsSync(join(process.cwd(), entry)), `${entry} missing`).toBe(true);
    }
  });

  it('generated output dir is gitignored (never committed)', () => {
    const gitignore = read('.gitignore');
    expect(gitignore).toContain(`${typedoc.out}/`);
  });
});
