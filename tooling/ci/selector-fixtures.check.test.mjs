/**
 * The selector fixture check (`selector-fixtures.check.mjs`, run by `pnpm agent-os:check`) on a
 * fixture repository: a clean page tree passes; a page that imports another section's page, a
 * recorded miss the selection still skips, and an unreachable test fail it. Also the boundary
 * fixes in the selection's mention rule.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
import { checkSelectorFixtures, sectionOf } from './selector-fixtures.check.mjs';
import { selectTests } from './test-selection.mjs';

const ROOM = 'src/pages/organization/$organizationSlug';
const scratch = [];

afterEach(() => {
  for (const directory of scratch.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function repository(extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'selector-fixtures-'));
  scratch.push(root);
  const files = {
    'tests/utils/setup.ts': '',
    'src/pages/login/login.route.tsx': "import { LoginPage } from './LoginPage.tsx';\n",
    'src/pages/login/LoginPage.tsx': 'export const LoginPage = 1;\n',
    'src/pages/login/LoginPage.test.tsx':
      "import { LoginPage } from './LoginPage.tsx';\n",
    [`${ROOM}/patients/patients.route.tsx`]: "import './PatientsPage.tsx';\n",
    [`${ROOM}/patients/PatientsPage.tsx`]: 'export const PatientsPage = 1;\n',
    [`${ROOM}/patients/PatientsPage.test.tsx`]: "import './PatientsPage.tsx';\n",
    [`${ROOM}/stock/stock.route.tsx`]: "import './StockPage.tsx';\n",
    [`${ROOM}/stock/StockPage.tsx`]: 'export const StockPage = 1;\n',
    [`${ROOM}/stock/StockPage.test.tsx`]: "import './StockPage.tsx';\n",
    [`${ROOM}/stock/purchases/purchases.route.tsx`]: "import './PurchasesPage.tsx';\n",
    [`${ROOM}/stock/purchases/PurchasesPage.tsx`]: 'export const StockPurchases = 1;\n',
    [`${ROOM}/stock/purchases/PurchasesPage.test.tsx`]: "import './PurchasesPage.tsx';\n",
    [`${ROOM}/medical/medical.route.tsx`]: "import './purchases/PurchasesPage.tsx';\n",
    [`${ROOM}/medical/purchases/purchases.route.tsx`]: "import './PurchasesPage.tsx';\n",
    [`${ROOM}/medical/purchases/PurchasesPage.tsx`]:
      'export const MedicalPurchases = 1;\n',
    [`${ROOM}/medical/purchases/PurchasesPage.test.tsx`]:
      "import './PurchasesPage.tsx';\n",
    ...extra,
  };
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe('checkSelectorFixtures', () => {
  test('a clean page tree passes, one fixture per route island', () => {
    const result = checkSelectorFixtures(repository());
    assert.deepEqual(result.problems, []);
    assert.equal(result.fixtures, 6);
    assert.equal(result.unreachable, 0);
  });

  test('a page that imports another section fails it', () => {
    const root = repository({
      [`${ROOM}/stock/StockPage.test.tsx`]:
        "import './StockPage.tsx';\nimport '../patients/PatientsPage.tsx';\n",
    });
    const { problems } = checkSelectorFixtures(root);
    assert.equal(problems.length, 1);
    assert.match(
      problems[0],
      /patients .*another section, e\.g\. .*stock\/StockPage\.test\.tsx/,
    );
  });

  test('a recorded miss the selection still skips fails it', () => {
    const root = repository({
      'tooling/ci/selector-fixtures.json': JSON.stringify({
        fixtures: [
          {
            name: 'miss: login',
            changed: [`${ROOM}/stock/StockPage.tsx`],
            mustSelect: ['src/pages/login/LoginPage.test.tsx'],
          },
        ],
      }),
    });
    const { problems, fixtures } = checkSelectorFixtures(root);
    assert.equal(fixtures, 7);
    assert.match(problems[0], /miss: login: .* does not select 1 test/);
  });

  test('an unreachable test is counted and run by every source change', () => {
    const root = repository({
      'src/shared/css/runtime-paths.test.ts':
        'const file = join(import.meta.dirname, name);\nexpect(file).toBeTruthy();\n',
    });
    const result = checkSelectorFixtures(root);
    assert.equal(result.unreachable, 1);
    assert.deepEqual(result.problems, []);
    const selection = selectTests({
      changedFiles: ['src/pages/login/LoginPage.tsx'],
      repositoryRoot: root,
    });
    assert.ok(
      selection.why['src/shared/css/runtime-paths.test.ts'].includes(
        'always run (no single change selects it)',
      ),
    );
  });
});

describe('sections and mentions', () => {
  test('a section is a top-level page or an organization room', () => {
    assert.equal(
      sectionOf('src/pages/login/forms/LoginForm/LoginForm.tsx'),
      'src/pages/login',
    );
    assert.equal(sectionOf(`${ROOM}/stock/purchases/PurchasesPage.tsx`), `${ROOM}/stock`);
    assert.equal(sectionOf(`${ROOM}/OrganizationLayout.tsx`), ROOM);
  });

  test('a file name held twice, or inside a longer name, is no mention', () => {
    const root = repository({
      [`${ROOM}/patients/NewPatientsPage.test.tsx`]:
        "it('NewPatientsPage.tsx renders');\n",
    });
    const stockPurchases = selectTests({
      changedFiles: [`${ROOM}/stock/purchases/PurchasesPage.tsx`],
      repositoryRoot: root,
    });
    assert.equal(
      stockPurchases.why[`${ROOM}/medical/purchases/PurchasesPage.test.tsx`],
      undefined,
    );
    const patients = selectTests({
      changedFiles: [`${ROOM}/patients/PatientsPage.tsx`],
      repositoryRoot: root,
    });
    const reasons = patients.why[`${ROOM}/patients/NewPatientsPage.test.tsx`] ?? [];
    assert.ok(
      !reasons.some((reason) => reason.startsWith('mentions')),
      reasons.join('; '),
    );
  });
});
