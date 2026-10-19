/**
 * The test selector (`test-selection.mjs`, `pnpm test:select`): each rule on a fixture repository,
 * the fail-closed cases, and its Vitest projects and setup files pinned to `vitest.config.ts`.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, test } from 'node:test';
import { describeSelection, parseSelectArguments } from './select-tests.mjs';
import {
  changedOnly,
  SETUP_FILES,
  selectTests,
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
  test('a page change selects the tests that import it, plus the always-run set — not other pages', () => {
    const root = fixture();
    const selection = select(root, ['src/pages/today/TodayPage.tsx']);
    assert.equal(selection.mode, 'selected');
    assert.deepEqual(selectedFiles(selection), [
      'src/pages/today/TodayPage.test.tsx',
      'tests/ci/docs.policy.test.ts',
      'tests/security/token.security.test.ts',
    ]);
    assert.deepEqual(selection.why['src/pages/today/TodayPage.test.tsx'], [
      'imports src/pages/today/TodayPage.tsx',
      'mentions src/pages/today/TodayPage.tsx',
    ]);
    assert.deepEqual(selection.why['tests/security/token.security.test.ts'], [
      'always run',
    ]);
    assert.deepEqual(selection.why['tests/ci/docs.policy.test.ts'], [
      'always run (imports nothing from the repository)',
    ]);
    assert.deepEqual(selection.projects.unit, ['src/pages/today/TodayPage.test.tsx']);
  });

  test('a docs or agent-os change selects only the tests that mention it, as a path or as segments', () => {
    const root = fixture();
    for (const changed of ['docs/guide.md', 'agent-os/hooks/guard.sh']) {
      const selection = select(root, [changed]);
      assert.deepEqual(
        selectedFiles(selection),
        ['tests/ci/docs.policy.test.ts'],
        changed,
      );
      assert.deepEqual(selection.why['tests/ci/docs.policy.test.ts'], [
        `mentions ${changed}`,
      ]);
    }
    assert.equal(select(root, ['docs/other.md']).mode, 'none');
  });

  test('walks a folder named like a build output (a reports page) — the button proof miss', () => {
    const root = fixture({
      'src/shared/ui/button.tsx': 'export const Button = 1;\n',
      'src/pages/patients/reports/ReportsPage.tsx':
        "import { Button } from '@/shared/ui/button.tsx';\n",
      'src/pages/patients/reports/__tests__/reports-router.tsx':
        "import { ReportsPage } from '../ReportsPage.tsx';\n",
      'src/pages/patients/reports/ReportsPage.test.tsx':
        "import { render } from './__tests__/reports-router.tsx';\n",
    });
    assert.ok(
      selectedFiles(select(root, ['src/shared/ui/button.tsx'])).includes(
        'src/pages/patients/reports/ReportsPage.test.tsx',
      ),
    );
  });

  test('follows import.meta.glob to the files it matches', () => {
    const root = fixture();
    const selection = select(root, ['src/shared/pins/data/pin-north.json']);
    assert.ok(selectedFiles(selection).includes('src/shared/pins/loader.test.ts'));
  });

  test('selects a changed test itself, and only it when it is all that changed', () => {
    const root = fixture();
    const selection = select(root, ['src/pages/billing/BillingPage.test.tsx']);
    assert.deepEqual(selectedFiles(selection), [
      'src/pages/billing/BillingPage.test.tsx',
    ]);
    assert.deepEqual(selection.why['src/pages/billing/BillingPage.test.tsx'], [
      'the changed test itself',
    ]);
  });

  test('runs everything for the escalation list, the setup closure and an unknown path', () => {
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
      assert.equal(selection.mode, 'all', changed);
      assert.match(selection.reasons[0], reason, changed);
    }
  });

  test('a deleted file still selects its importers; one nothing imports runs everything', () => {
    const root = fixture();
    rmSync(join(root, 'src/pages/billing/BillingPage.tsx'));
    assert.ok(
      selectedFiles(select(root, ['src/pages/billing/BillingPage.tsx'])).includes(
        'src/pages/billing/BillingPage.test.tsx',
      ),
    );
    const gone = select(root, ['src/pages/gone/Gone.tsx']);
    assert.equal(gone.mode, 'all');
    assert.match(gone.reasons[0], /deleted and nothing imports it/);
  });

  test('fails closed on any error, and selects nothing for no change', () => {
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
    assert.equal(broken.mode, 'all');
    assert.match(broken.reasons[0], /selector error/);
    assert.equal(select(root, []).mode, 'none');
  });

  test('changedOnly drops the always-run tests and turns everything into nothing; --exclude filters', () => {
    const root = fixture();
    const page = select(root, ['src/pages/today/TodayPage.tsx']);
    assert.deepEqual(selectedFiles(changedOnly(page)), [
      'src/pages/today/TodayPage.test.tsx',
    ]);
    assert.equal(changedOnly(select(root, ['package.json'])).mode, 'none');
    const excluded = withoutTests({ selection: page, globs: ['tests/**'] });
    assert.deepEqual(selectedFiles(excluded), ['src/pages/today/TodayPage.test.tsx']);
    assert.equal(withoutTests({ selection: page, globs: ['**'] }).mode, 'none');
  });
});

describe('pinned to vitest.config.ts', () => {
  test('the projects and the setup files are the ones Vitest runs', () => {
    const config = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8');
    for (const { name, include } of VITEST_PROJECTS) {
      assert.ok(config.includes(`name: '${name}'`), name);
      for (const glob of include) assert.ok(config.includes(`'${glob}'`), glob);
    }
    assert.equal(
      (config.match(/name: '[a-z-]+'/g) ?? []).length,
      VITEST_PROJECTS.length,
      'a project in vitest.config.ts the selector does not know',
    );
    for (const setup of SETUP_FILES) assert.ok(config.includes(`'./${setup}'`), setup);
  });
});

describe('pnpm test:select', () => {
  test('reads --files, --why, --json, --changed-only and repeated --exclude', () => {
    assert.deepEqual(
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
      {
        base: undefined,
        files: ['a.ts', 'b.md'],
        why: true,
        json: false,
        run: false,
        changedOnly: true,
        exclude: ['tests/**', 'src/x/**'],
      },
    );
  });

  test('describes a selection of this repository, as text or JSON', () => {
    const text = describeSelection(['--files', 'package.json']);
    assert.equal(text.selection.mode, 'all');
    assert.equal(text.lines[0], 'Selection: all');
    const json = describeSelection(['--files', 'docs/reference/design.md', '--json']);
    assert.deepEqual(JSON.parse(json.lines[0]), json.selection);
    assert.notEqual(json.selection.mode, 'all');
  });
});
