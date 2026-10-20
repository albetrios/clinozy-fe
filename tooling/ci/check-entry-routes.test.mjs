import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const TRIPWIRE = join(ROOT, 'tooling/ci/check-entry-routes.mjs');

const SLUG = '/organization/$organizationSlug';
const manifest = (path) =>
  `export const manifest = { segment: 'x', path: '${path}', kind: 'leaf' };\n`;

/** A source tree like the app's: one page with a static manifest, one dialog route, one room's builders. */
const SOURCES = {
  'src/app/routes/routeTree.tsx':
    "import { manifest as leadsManifest } from '@/pages/organization/$organizationSlug/leads/leads.manifest.ts';\n",
  'src/app/routes/dialog-routes.ts':
    "import { manifest as leadCreateManifest } from '@/pages/organization/$organizationSlug/leads/create/create.manifest.ts';\n",
  'src/pages/organization/$organizationSlug/leads/leads.manifest.ts': manifest(
    `${SLUG}/leads`,
  ),
  'src/pages/organization/$organizationSlug/leads/create/create.manifest.ts': manifest(
    `${SLUG}/leads/create`,
  ),
  'src/lib/routes/builders.ts': `export const home = (s) => ({ to: '${SLUG}', params: { organizationSlug: s } });\n`,
  'src/lib/routes/leads-builders.ts': [
    `export const leads = (s) => ({ to: '${SLUG}/leads', params: { organizationSlug: s } });`,
    `export const lead = (s, id) => ({ to: '${SLUG}/leads/$leadId', params: { organizationSlug: s, leadId: id } });`,
    `export const section = (s, id, x) => ({ to: \`${SLUG}/patients/$patientId/\${x}\` });`,
    '',
  ].join('\n'),
};

const HTML = [
  '<script type="module" crossorigin src="/assets/index-abc.js"></script>',
  '<link rel="modulepreload" crossorigin href="/assets/vendor-def.js">',
].join('\n');

/**
 * Run the tripwire against a throwaway tree. A gate nobody has watched fail is
 * a green checkmark (agent-os/skills/fe-guard-authoring), and the fixtures that
 * make it fail cannot live in the real `dist/` or `src/`.
 */
function run({ entry, vendor = 'export const v = 1;\n', html = HTML, sources = {} }) {
  const root = mkdtempSync(join(tmpdir(), 'entry-routes-'));
  try {
    const files = {
      ...SOURCES,
      ...sources,
      'dist/index.html': html,
      'dist/assets/index-abc.js': entry,
      'dist/assets/vendor-def.js': vendor,
      // A lazy chunk may carry anything: it is not first paint.
      'dist/assets/dialog-routes-ghi.js': `const m={path:\`${SLUG}/leads/create\`};\n`,
    };
    for (const [relativePath, content] of Object.entries(files)) {
      if (content === null) continue;
      const file = join(root, relativePath);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
    const result = spawnSync('node', [TRIPWIRE], {
      encoding: 'utf8',
      env: { ...process.env, ENTRY_ROUTES_ROOT: root },
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** A minified entry that carries the page's manifest and the org-level builder — as it should. */
const CLEAN_ENTRY = `var a={segment:\`leads\`,path:\`${SLUG}/leads\`,kind:\`leaf\`};function h(e){return{to:\`${SLUG}\`,params:{organizationSlug:e}}}\n`;

it('passes when the entry carries only the pages’ own paths', () => {
  const { status, output } = run({ entry: CLEAN_ENTRY });
  expect(status, output).toBe(0);
  expect(output).toMatch(/build:check OK/);
});

it('fails on a dialog manifest in the entry chunk', () => {
  const { status, output } = run({
    entry: `${CLEAN_ENTRY}var b={segment:\`create\`,path:\`${SLUG}/leads/create\`,kind:\`leaf\`};\n`,
  });
  expect(status, output).toBe(1);
  expect(output).toMatch(/build:check FAILED/);
  expect(output).toMatch(
    /leads\/create .*create\.manifest\.ts.* in assets\/index-abc\.js/,
  );
});

it('fails on a dialog manifest the route tree imports statically again', () => {
  // The way it used to be registered: the tree importing the dialog's manifest
  // does not make its path a page's.
  const { status, output } = run({
    entry: `${CLEAN_ENTRY}var b={path:\`${SLUG}/leads/create\`};\n`,
    sources: {
      'src/app/routes/routeTree.tsx': [
        SOURCES['src/app/routes/routeTree.tsx'],
        "import { manifest as leadCreateManifest } from '@/pages/organization/$organizationSlug/leads/create/create.manifest.ts';\n",
      ].join(''),
    },
  });
  expect(status, output).toBe(1);
  expect(output).toMatch(
    /leads\/create .*create\.manifest\.ts.* in assets\/index-abc\.js/,
  );
});

it('fails on a room builder in a modulepreloaded chunk', () => {
  const { status, output } = run({
    entry: CLEAN_ENTRY,
    vendor: `function l(e,t){return{to:"${SLUG}/leads/$leadId",params:{organizationSlug:e,leadId:t}}}\n`,
  });
  expect(status, output).toBe(1);
  expect(output).toMatch(
    /leads\/\$leadId .*leads-builders\.ts.* in assets\/vendor-def\.js/,
  );
});

it('allows a room builder’s page path — the page’s manifest carries it anyway', () => {
  // `leads-builders.ts` spells `/leads`, which `leads.manifest.ts` (a static
  // import of the route tree) puts on the first paint by design.
  const { status, output } = run({ entry: `${CLEAN_ENTRY}const p='${SLUG}/leads';\n` });
  expect(status, output).toBe(0);
});

it('ignores lazy chunks: a dialog manifest may load on demand', () => {
  const { status, output } = run({ entry: CLEAN_ENTRY });
  expect(status, output).toBe(0);
  expect(output).not.toMatch(/dialog-routes-ghi/);
});

it('fails when the build has not run', () => {
  const { status, output } = run({ entry: CLEAN_ENTRY, html: null });
  expect(status, output).toBe(1);
  expect(output).toMatch(/Run `pnpm build` first/);
});
