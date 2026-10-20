/**
 * The test selector (`test-selection.mjs`, `pnpm test:select`): each rule on a fixture repository,
 * the fail-closed cases, and its Vitest projects and setup files pinned to `vitest.config.ts`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describeSelection, parseSelectArguments } from './select-tests.mjs';
import {
  changedOnly,
  SETUP_FILES,
  selectTests,
  TEST_SOURCE_POLICIES,
  VITEST_PROJECTS,
  withoutTests,
} from './test-selection.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const scratch = [];

afterEach(() => {
  for (const directory of scratch.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

/** A fixture repository: one page, a shared module, the setup, a security test and two scanners. */
function fixture(extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'test-selection-'));
  scratch.push(root);
  const files = {
    'src/pages/today/TodayPage.tsx': "import { core } from '@/lib/core.ts';\n",
    'src/pages/today/TodayPage.test.tsx':
      "import { TodayPage } from './TodayPage.tsx';\n",
    'src/pages/billing/BillingPage.tsx': 'export const BillingPage = 1;\n',
    'src/pages/billing/BillingPage.test.tsx':
      "import { BillingPage } from '@/pages/billing/BillingPage.tsx';\n",
    'src/lib/core.ts': 'export const core = 1;\n',
    'src/shared/pins/loader.ts': "const parts = import.meta.glob('./data/pin-*.json');\n",
    'src/shared/pins/loader.test.ts': "import './loader.ts';\n",
    'src/shared/pins/data/pin-north.json': '{}\n',
    'tests/utils/setup.ts': "import '@/lib/core.ts';\n",
    'tests/utils/render.ts': 'export const render = 1;\n',
    'tests/security/token.security.test.ts':
      "import { render } from '@/tests/utils/render.ts';\n",
    'tests/ci/docs.policy.test.ts':
      "const guide = 'docs/guide.md';\nconst hooks = join('agent-os', 'hooks');\n",
    'docs/guide.md': '# Guide\n',
    'agent-os/hooks/guard.sh': '#!/bin/sh\n',
    ...extra,
  };
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const select = (repositoryRoot, changedFiles) =>
  selectTests({ changedFiles, repositoryRoot });
const selectedFiles = (selection) => Object.values(selection.projects).flat().sort();

describe('selectTests', () => {
  it('a page change selects the tests that import it, plus the always-run set — not other pages', () => {
    const root = fixture();
    const selection = select(root, ['src/pages/today/TodayPage.tsx']);
    expect(selection.mode).toBe('selected');
    expect(selectedFiles(selection)).toStrictEqual([
      'src/pages/today/TodayPage.test.tsx',
      'tests/ci/docs.policy.test.ts',
      'tests/security/token.security.test.ts',
    ]);
    expect(selection.why['src/pages/today/TodayPage.test.tsx']).toStrictEqual([
      'imports src/pages/today/TodayPage.tsx',
      'mentions src/pages/today/TodayPage.tsx',
    ]);
    expect(selection.why['tests/security/token.security.test.ts']).toStrictEqual([
      'always run',
    ]);
    expect(selection.why['tests/ci/docs.policy.test.ts']).toStrictEqual([
      'always run (imports nothing from the repository)',
    ]);
    expect(selection.projects.unit).toStrictEqual(['src/pages/today/TodayPage.test.tsx']);
  });

  it('a docs or agent-os change selects only the tests that mention it, as a path or as segments', () => {
    const root = fixture();
    for (const changed of ['docs/guide.md', 'agent-os/hooks/guard.sh']) {
      const selection = select(root, [changed]);
      expect(selectedFiles(selection), changed).toStrictEqual([
        'tests/ci/docs.policy.test.ts',
      ]);
      expect(selection.why['tests/ci/docs.policy.test.ts']).toStrictEqual([
        `mentions ${changed}`,
      ]);
    }
    expect(select(root, ['docs/other.md']).mode).toBe('none');
  });

  it('walks a folder named like a build output (a reports page) — the button proof miss', () => {
    const root = fixture({
      'src/shared/ui/button.tsx': 'export const Button = 1;\n',
      'src/pages/patients/reports/ReportsPage.tsx':
        "import { Button } from '@/shared/ui/button.tsx';\n",
      'src/pages/patients/reports/__tests__/reports-router.tsx':
        "import { ReportsPage } from '../ReportsPage.tsx';\n",
      'src/pages/patients/reports/ReportsPage.test.tsx':
        "import { render } from './__tests__/reports-router.tsx';\n",
    });
    expect(
      selectedFiles(select(root, ['src/shared/ui/button.tsx'])).includes(
        'src/pages/patients/reports/ReportsPage.test.tsx',
      ),
    ).toBeTruthy();
  });

  it('follows import.meta.glob to the files it matches', () => {
    const root = fixture();
    const selection = select(root, ['src/shared/pins/data/pin-north.json']);
    expect(
      selectedFiles(selection).includes('src/shared/pins/loader.test.ts'),
    ).toBeTruthy();
  });

  it('selects a changed test itself, and only it when it is all that changed', () => {
    const root = fixture();
    const selection = select(root, ['src/pages/billing/BillingPage.test.tsx']);
    expect(selectedFiles(selection)).toStrictEqual([
      'src/pages/billing/BillingPage.test.tsx',
    ]);
    expect(selection.why['src/pages/billing/BillingPage.test.tsx']).toStrictEqual([
      'the changed test itself',
    ]);
  });

  it('runs the test-source policies with a changed test, when the repository has them', () => {
    const root = fixture(
      Object.fromEntries(TEST_SOURCE_POLICIES.map((policy) => [policy, 'export {};\n'])),
    );
    const selection = select(root, ['src/pages/billing/BillingPage.test.tsx']);
    expect(selectedFiles(selection)).toStrictEqual(
      ['src/pages/billing/BillingPage.test.tsx', ...TEST_SOURCE_POLICIES].sort(),
    );
    for (const policy of TEST_SOURCE_POLICIES) {
      expect(selection.why[policy]).toStrictEqual([
        "reads every test's source (src/pages/billing/BillingPage.test.tsx)",
      ]);
    }
  });

  it('runs everything for the escalation list, the setup closure and an unknown path', () => {
    const root = fixture();
    for (const [changed, reason] of [
      ['package.json', /escalation list/],
      ['vitest.config.ts', /escalation list/],
      ['plugins/test-env.ts', /escalation list/],
      ['tsconfig.app.json', /escalation list/],
      ['src/locales/en/common.json', /escalation list/],
      ['tests/utils/setup.ts', /test setup/],
      ['src/lib/core.ts', /loaded by the test setup/],
      ['weird/thing.txt', /outside the known roots/],
    ]) {
      const selection = select(root, [changed]);
      expect(selection.mode, changed).toBe('all');
      expect(selection.reasons[0], changed).toMatch(reason);
    }
  });

  it('a deleted file still selects its importers; one nothing imports runs everything', () => {
    const root = fixture();
    rmSync(join(root, 'src/pages/billing/BillingPage.tsx'));
    expect(
      selectedFiles(select(root, ['src/pages/billing/BillingPage.tsx'])).includes(
        'src/pages/billing/BillingPage.test.tsx',
      ),
    ).toBeTruthy();
    const gone = select(root, ['src/pages/gone/Gone.tsx']);
    expect(gone.mode).toBe('all');
    expect(gone.reasons[0]).toMatch(/deleted and nothing imports it/);
  });

  it('fails closed on any error, and selects nothing for no change', () => {
    const root = fixture();
    const broken = selectTests({
      changedFiles: ['src/pages/today/TodayPage.tsx'],
      repositoryRoot: root,
      graph: {
        files: [],
        tests: ['src/missing.test.ts'],
        imports: new Map(),
        importers: new Map(),
      },
    });
    expect(broken.mode).toBe('all');
    expect(broken.reasons[0]).toMatch(/selector error/);
    expect(select(root, []).mode).toBe('none');
  });

  it('changedOnly drops the always-run tests and turns everything into nothing; --exclude filters', () => {
    const root = fixture();
    const page = select(root, ['src/pages/today/TodayPage.tsx']);
    expect(selectedFiles(changedOnly(page))).toStrictEqual([
      'src/pages/today/TodayPage.test.tsx',
    ]);
    expect(changedOnly(select(root, ['package.json'])).mode).toBe('none');
    const excluded = withoutTests({ selection: page, globs: ['tests/**'] });
    expect(selectedFiles(excluded)).toStrictEqual(['src/pages/today/TodayPage.test.tsx']);
    expect(withoutTests({ selection: page, globs: ['**'] }).mode).toBe('none');
  });
});

describe('pinned to vitest.config.ts', () => {
  it('the projects and the setup files are the ones Vitest runs', () => {
    const config = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8');
    for (const { name, include } of VITEST_PROJECTS) {
      expect(config.includes(`name: '${name}'`), name).toBeTruthy();
      for (const glob of include) expect(config.includes(`'${glob}'`), glob).toBeTruthy();
    }
    expect(
      (config.match(/name: '[a-z-]+'/g) ?? []).length,
      'a project in vitest.config.ts the selector does not know',
    ).toBe(VITEST_PROJECTS.length);
    for (const setup of SETUP_FILES)
      expect(config.includes(`'./${setup}'`), setup).toBeTruthy();
  });
});

describe('pnpm test:select', () => {
  it('reads --files, --why, --json, --changed-only and repeated --exclude', () => {
    expect(
      parseSelectArguments([
        '--files',
        'a.ts,b.md',
        '--why',
        '--exclude',
        'tests/**',
        '--exclude',
        'src/x/**',
        '--changed-only',
      ]),
    ).toStrictEqual({
      base: undefined,
      files: ['a.ts', 'b.md'],
      why: true,
      json: false,
      run: false,
      changedOnly: true,
      exclude: ['tests/**', 'src/x/**'],
    });
  });

  it('describes a selection of this repository, as text or JSON', () => {
    const text = describeSelection(['--files', 'package.json']);
    expect(text.selection.mode).toBe('all');
    expect(text.lines[0]).toBe('Selection: all');
    const json = describeSelection(['--files', 'docs/reference/design.md', '--json']);
    expect(JSON.parse(json.lines[0])).toStrictEqual(json.selection);
    expect(json.selection.mode).not.toBe('all');
  });
});
