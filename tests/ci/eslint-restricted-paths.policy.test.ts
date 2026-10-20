import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// Locks the icon/toast import boundary (`RESTRICTED_IMPORT_PATHS` in `eslint.config.mjs`)
// against the REAL config, in every layer that re-declares `no-restricted-imports`. Flat config
// REPLACES a rule's options rather than merging them, so a layer block that restated only its
// `patterns` silently dropped the paths: until 20 Oct 2026 lib, core, shared and pages could import
// `lucide-react` and `sonner` directly, and only the planted-bug drill noticed.
const RULE = 'no-restricted-imports';

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: process.cwd() });
});

/** The boundary's messages for one import in a probe file at `filePath`. */
async function restricted(options: {
  source: string;
  filePath: string;
}): Promise<string[]> {
  const [result] = await eslint.lintText(options.source, { filePath: options.filePath });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === RULE)
    .map((message) => message.message);
}

const LAYERS = [
  'src/app/Probe.tsx',
  'src/lib/probe.ts',
  'src/core/config/probe.ts',
  'src/core/http/probe.ts',
  'src/shared/components/Probe/Probe.tsx',
  'src/shared/components/LocalizedCalendar/Probe.tsx',
  'src/pages/probe/ProbePage.tsx',
];

describe('icons and toasts go through their one wrapper, in every layer', () => {
  it.each(LAYERS)('%s may not import lucide-react', async (filePath) => {
    const messages = await restricted({
      source: "import { Bell } from 'lucide-react';\nexport const icon = Bell;\n",
      filePath,
    });
    expect(messages.join('\n')).toContain('@/shared/icons/index.ts');
  });

  it.each(LAYERS)('%s may not import sonner', async (filePath) => {
    const messages = await restricted({
      source: "import { toast } from 'sonner';\nexport const notify = toast;\n",
      filePath,
    });
    expect(messages.join('\n')).toContain('@/shared/notify');
  });

  it.each(['src/shared/icons/probe.ts', 'src/shared/notify/probe.ts'])(
    '%s, a sanctioned wrapper, may import them and keeps the shared layer boundary',
    async (filePath) => {
      const wrapper = await restricted({
        source:
          "import { Bell } from 'lucide-react';\nimport { toast } from 'sonner';\nexport { Bell, toast };\n",
        filePath,
      });
      expect(wrapper).toEqual([]);
      const boundary = await restricted({
        source: "import { Page } from '@/pages/probe/ProbePage.tsx';\nexport { Page };\n",
        filePath,
      });
      expect(boundary.join('\n')).toContain('src/shared must not depend on pages or app');
    },
  );
});
