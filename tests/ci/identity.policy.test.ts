import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { wordmarkParts } from '@/lib/brand-wordmark.ts';

import { productWordmarkHtml } from '../../plugins/product-identity-html.ts';
import {
  backendDirEnvVar,
  derivedSurfaces,
  findDrift,
  findIncompleteTransforms,
  findPreviousNames,
  isDistinctiveWord,
  loadIdentity,
  matchCase,
  NAMESPACE_STORAGE_KEYS,
  patternFor,
  planRename,
  renamedFiles,
  renderProductIdentityModule,
  staleBaselines,
  wholeWord,
} from '../../tooling/identity/identity.mjs';

/**
 * Locks the product-identity contract: one source of truth
 * (`tooling/setup/setup.config.json` → `project.*`), every other occurrence
 * derived from it, and no brand literal creeping back into app code or copy.
 *
 * Two failures already caught here, both of the same shape — a guard that looked
 * green while shipping stale branding:
 *   1. `setup.config.json` said `albetrios/clinozy-fe` while `catalog-info.yaml`
 *      said `core/clinozy-fe` — two identity sources disagreeing.
 *   2. The locale transform covered `brand.name` but not `footerCopyright` or the
 *      onboarding question, leaving 22 stale user-visible strings after a rename.
 * The completeness invariant below is the generic answer to (2).
 */
const ROOT = process.cwd();
const read = (file: string): string => readFileSync(join(ROOT, file), 'utf8');

/** Every .ts/.tsx file under a directory, recursively. */
function srcFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) srcFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}
const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'pt', 'zh'];

describe('product identity', () => {
  const identity = loadIdentity(ROOT);

  it('declares every required identity field', () => {
    const missing = Object.entries(identity)
      // `previousNames` is a list (empty is correct for a never-renamed repo).
      .filter(([key]) => key !== 'previousNames')
      .filter(([, value]) => typeof value !== 'string' || value.length === 0)
      .map(([key]) => key);
    expect(missing).toEqual([]);
  });

  it('has no derived-surface drift', () => {
    // Mirrors `pnpm validate:identity`. Fix a failure with `pnpm identity:sync`.
    expect(findDrift(identity, ROOT)).toEqual([]);
  });

  it('leaves no trace of the old name after a rename', () => {
    // The completeness invariant: a partial transform is worse than none, because
    // drift stays clean and the rename reports success while branding is stale.
    expect(findIncompleteTransforms(identity, ROOT)).toEqual([]);
  });

  it('keeps the generated module byte-identical to its renderer', () => {
    expect(read('src/lib/product-identity.ts')).toBe(
      renderProductIdentityModule(identity),
    );
  });

  it('covers every surface that embeds the product or package name', () => {
    const files = derivedSurfaces(identity, ROOT).map((surface) => surface.file);
    for (const expected of [
      'src/lib/product-identity.ts',
      'package.json',
      'public/manifest.webmanifest',
      'public/app-icon.svg',
      'public/offline.html',
      'public/robots.txt',
      'catalog-info.yaml',
      '.github/CODEOWNERS',
      '.github/workflows/preview.yml',
      '.github/workflows/reusable-netlify-deploy.yml',
      'sonar-project.properties',
      'docker-compose.sonar.yml',
    ]) {
      expect(files).toContain(expected);
    }
  });

  it('keeps index.html branding tokenized, never hardcoded', () => {
    // `plugins/product-identity-html.ts` substitutes these at transform time.
    const html = read('index.html');
    expect(html).toContain('<title>{{PRODUCT_NAME}}</title>');
    expect(html).toContain('{{PRODUCT_THEME_COLOR}}');
    // The boot splash: its label and its wordmark drawing. The wordmark span may
    // carry more attributes (its `dir="ltr"`) on any lines Prettier puts them;
    // what holds is that its content is the token, never a drawn name.
    expect(html).toContain('aria-label="Loading {{PRODUCT_NAME}}"');
    expect(html).toMatch(
      /class="app-splash-word"(?:\s+[\w-]+="[^"]*")*\s*>\{\{PRODUCT_WORDMARK\}\}</,
    );
    expect(html).not.toContain(`<title>${identity.productName}</title>`);
    const { head, tail } = wordmarkParts(identity.productName);
    expect(html).not.toContain(`${head}<svg`);
    expect(html).not.toContain(`</svg>${tail}`);
  });

  it('draws the splash wordmark from the product name, like ProductWordmark', () => {
    const { head, ring, tail } = wordmarkParts(identity.productName);
    const markup = productWordmarkHtml(identity.productName);
    expect(markup.startsWith(head)).toBe(true);
    expect(markup.endsWith(tail)).toBe(true);
    expect(markup.includes('<svg')).toBe(ring);
    // A brand without an "o" is plain text — and the markup escapes the name.
    expect(productWordmarkHtml('Acme & Co')).toBe(
      'acme &amp; c<svg class="app-splash-ring" viewBox="0 0 20 20" aria-hidden="true"><circle class="app-splash-ring-line" cx="10" cy="10" r="7.6" fill="none" stroke-width="4.2" /><circle class="app-splash-ring-dot" cx="10" cy="10" r="3" /></svg>',
    );
    expect(productWordmarkHtml('Acme')).toBe('acme');
  });

  it('routes app code through the generated module, not a literal', () => {
    expect(read('src/lib/routes/page-head.ts')).toContain(
      "from '@/lib/product-identity.ts'",
    );
    expect(read('src/core/config/app-manifest.ts')).toContain(
      "from '@/lib/product-identity.ts'",
    );
  });

  describe('translated copy carries no brand', () => {
    it('resolves {{productName}} from the identity block', () => {
      // Without this wiring every {{productName}} would render empty.
      const config = read('src/lib/i18n/i18n.ts');
      expect(config).toContain("from '@/lib/product-identity.ts'");
      expect(config).toContain('productName: PRODUCT_NAME,');
      expect(config).toContain('productDomain: `${PRODUCT_NAMESPACE}.app`,');
    });

    it.each(LOCALES)('%s locale uses the variable, not the product name', (locale) => {
      for (const namespace of ['layout', 'onboarding']) {
        const json = read(`src/locales/${locale}/${namespace}.json`);
        expect(json).toContain('{{productName}}');
      }
      expect(read(`src/locales/${locale}/onboarding.json`)).toContain(
        '{{productDomain}}',
      );
      // EVERY namespace, and case-insensitive: a lowercase `core.app` hid in 11
      // onboarding files because this matched only "Core". ASCII-bounded, not \b —
      // Korean reads "Core를" with no space and Hangul counts as a word char.
      for (const file of readdirSync(join(ROOT, 'src/locales', locale))) {
        const json = read(`src/locales/${locale}/${file}`);
        for (const brand of [identity.productName, identity.namespace]) {
          const caseless = new RegExp(wholeWord(brand).source, 'gi');
          expect(json.match(caseless), `${locale}/${file} carries "${brand}"`).toBeNull();
        }
      }
    });

    it('keeps locale files off the rebrand surface entirely', () => {
      const files = derivedSurfaces(identity, ROOT).map((surface) => surface.file);
      expect(files.filter((file) => file.startsWith('src/locales/'))).toEqual([]);
    });
  });

  describe('total rename', () => {
    const rename = (): Array<{ file: string; count: number; next: string }> =>
      planRename(ROOT, [
        [identity.name, 'zzslug-fe'],
        [identity.productName, 'ZzProduct'],
        [identity.displayName, 'ZzProduct Frontend'],
      ]);

    it('reaches prose that no structural transform can anchor', () => {
      // "clinozy-fe is trunk-based" has nothing to hook, so a rename must sweep text
      // files too. Without this pass a derived product keeps ~200 stale mentions.
      const plan = rename();
      expect(plan.length).toBeGreaterThan(100);
      expect(plan.map((change) => change.file)).toContain(
        'docs/process/trunk-based-workflow.md',
      );
    });

    /**
     * Count a phrase before vs after a rename.
     *
     * Compared as counts rather than by searching the output for a renamed variant,
     * because this very file contains those sentinels as source text — a
     * `not.toMatch(/…-be/)` assertion matches its own regex literal and fails.
     */
    const preservedEverywhere = (phrase: string): void => {
      for (const change of rename()) {
        const before = read(change.file).split(phrase).length - 1;
        const after = change.next.split(phrase).length - 1;
        expect(after, `${phrase} changed in ${change.file}`).toBe(before);
      }
    };

    it('renames the sibling backend with the product', () => {
      // A derived product normally forks the backend too, so the frontend's ~450
      // references must follow — including contracts:drift, which resolves
      // ../<backendName>/docs/routes.txt, and the uppercase env-var spelling, which
      // is a distinct token the slug pass cannot see.
      const plan = planRename(ROOT, [
        [identity.backendName, 'zzslug-be'],
        [backendDirEnvVar(identity.backendName), backendDirEnvVar('zzslug-be')],
      ]);
      const files = plan.map((change) => change.file);
      expect(files).toContain('tooling/ci/check-api-contract-drift.mjs');
      const drift = plan.find(
        (change) => change.file === 'tooling/ci/check-api-contract-drift.mjs',
      );
      expect(drift?.next).toContain('../zzslug-be');
      expect(drift?.next).toContain('ZZSLUG_BE_DIR');
      expect(drift?.next).not.toContain('CLINOZY_BE_DIR');
    });

    it('derives the backend env-var name from the backend slug', () => {
      expect(backendDirEnvVar('clinozy-be')).toBe('CLINOZY_BE_DIR');
      expect(backendDirEnvVar('acme-be')).toBe('ACME_BE_DIR');
    });

    it('preserves phrases that merely contain the product name', () => {
      // "Core Web Vitals" is Google's metric. A blanket rename invented a metric
      // that does not exist, in 14 files.
      preservedEverywhere('Core Web Vitals');
    });

    // Every name in the tests below is invented (`acme` → `zenith`). A test that used
    // the real brand was itself rewritten by the next rename: its expectations were
    // updated, its input was not, and it failed while testing nothing new.
    it('keeps a PascalCase identifier PascalCase', () => {
      // camelPrefix() matches a case-flexible first character (`[aA]cmeFe`), so
      // without preserveCase the camelCase replacement was written over a
      // PascalCase match: `type AcmeFeRouter` became `type zenithFeRouter`.
      // Type names are free-form, so tsc and eslint both stayed green.
      const { regex, preserveCase } = patternFor('acmeFe');
      expect(preserveCase).toBe(true);
      const apply = (text: string) =>
        text.replace(regex, (m: string) =>
          preserveCase ? matchCase(m, 'zenithFe') : 'zenithFe',
        );
      expect(apply('type AcmeFeRouter = {')).toBe('type ZenithFeRouter = {');
      expect(apply('globalThis.__acmeFeRouter')).toBe('globalThis.__zenithFeRouter');
    });

    it('renames a bare camelCase token at the end of an identifier', () => {
      // The matcher once required a capital AFTER the prefix, so a bare `'acmeFe'`
      // string survived a rename untouched and invisible to the retired-name guard.
      const { regex } = patternFor('acmeFe');
      const apply = (text: string) => text.replace(regex, 'zenithFe');
      expect(apply("matchCase(m, 'acmeFe')")).toBe("matchCase(m, 'zenithFe')");
      // …but never a longer lowercase word that merely starts with the prefix.
      expect(apply('acmeFeather acmeFe2')).toBe('acmeFeather acmeFe2');
    });

    it('sweeps and guards the bare product word only when it is distinctive', () => {
      // A common word ("Core Philosophy", src/core/) must never be swept; an invented
      // one must be, or "Organizations · <OldProduct>" survives in docs.
      expect(isDistinctiveWord('Core')).toBe(false);
      expect(isDistinctiveWord('core')).toBe(false);
      expect(isDistinctiveWord('Zenithia')).toBe(true);
      expect(isDistinctiveWord('zenithia')).toBe(true);
      expect(isDistinctiveWord('zenith-fe')).toBe(false);
      // Pins the wiring: the helper is useless if the rebrand never calls it.
      const script = read('tooling/identity/rebrand.mjs');
      expect(script).toContain('isDistinctiveWord(current.productName)');
      expect(script).toContain('isDistinctiveWord(current.namespace)');
      expect(script).toContain(
        '[current.productName, current.namespace].filter(isDistinctiveWord)',
      );
    });

    it('covers every colon-namespaced storage key the app derives', () => {
      // These keys are built from PRODUCT_NAMESPACE at runtime, so they rename
      // themselves — but the LITERALS in docs and test fixtures do not. When
      // `<old>:last-activity` and `<old>:version-check:` were left behind, the app
      // wrote `<new>:*` while a Playwright fixture cleared `<old>:*`: a suite
      // green because it asserted nothing. Derived from source so a new key
      // cannot be added without also teaching the rebrand about it.
      const derived = new Set<string>();
      for (const file of srcFiles(join(ROOT, 'src'))) {
        for (const match of readFileSync(file, 'utf8').matchAll(
          /\$\{PRODUCT_NAMESPACE\}:([a-z-]+)/g,
        )) {
          const key = match[1];
          if (key) derived.add(key);
        }
      }
      expect(derived.size).toBeGreaterThan(0);
      for (const key of derived) {
        expect(NAMESPACE_STORAGE_KEYS).toContain(key);
      }
    });

    it('leaves real history and generated artifacts alone', () => {
      const files = rename().map((change) => change.file);
      expect(files).not.toContain('CHANGELOG.md');
      expect(files).not.toContain('pnpm-lock.yaml');
    });

    it('renames files whose NAME embeds the identity', () => {
      // Contents-only rewriting left a derived product with files literally named
      // after the previous product, reddening tool:project-structure-tree:check on
      // every adoption. Nothing renamed files before this.
      expect(renamedFiles(identity, ROOT)).toEqual([]);
      const renamed = { ...identity, backendName: 'zzslug-be' };
      const pending = renamedFiles(renamed, ROOT);
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0]?.to).toContain('zzslug-be-sample-responses.json');
    });

    it('runs the rebrand script without a scope error', () => {
      // A local `let renamedFiles` once shadowed the imported function for the whole
      // function scope, so the on-disk rename hit a temporal-dead-zone ReferenceError
      // and crashed the whole script. Assert the identifier is not re-bound locally.
      const script = read('tooling/identity/rebrand.mjs');
      expect(script).not.toMatch(/\b(?:let|const|var)\s+renamedFiles\b/);
    });

    it('deletes visual baselines, which no text rewrite can rebrand', () => {
      // The baselines RENDER the brand. Left in place after a rename they fail
      // SILENTLY: at maxDiffPixelRatio 0.02 the light ones still pass while
      // encoding the previous logo, so a derived product fixes the 2 dark failures
      // and ships 3 baselines asserting the old brand is correct. `pnpm rebrand`
      // deletes them so the next `test:visual` fails loudly instead.
      //
      // Probed on a scratch tree, not the repo: right after a rename the repo has
      // NO baselines (rebrand deleted them, and only a local `test:visual` run
      // against the backend can regenerate them), so asserting on the real folder
      // reddened CI for every PR until someone did.
      const scratch = mkdtempSync(join(tmpdir(), 'identity-baselines-'));
      try {
        const snapshots = join(scratch, 'tests/e2e/visual.e2e.test.ts-snapshots');
        mkdirSync(snapshots, { recursive: true });
        for (const name of [
          'login-light-chromium.png',
          'login-dark-chromium.png',
          'notes.md',
        ]) {
          writeFileSync(join(snapshots, name), '');
        }
        expect(staleBaselines(scratch)).toEqual([
          'tests/e2e/visual.e2e.test.ts-snapshots/login-dark-chromium.png',
          'tests/e2e/visual.e2e.test.ts-snapshots/login-light-chromium.png',
        ]);
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
      // That folder is Playwright's default `<spec>-snapshots` for the visual spec,
      // so the helper looks exactly where `toHaveScreenshot` writes.
      expect(read('tests/e2e/visual.e2e.test.ts')).toContain('toHaveScreenshot(');
      expect(read('playwright.config.ts')).not.toMatch(/snapshot(?:PathTemplate|Dir)/);
      // Pins the wiring: the helper existing is useless if rebrand never calls it.
      expect(read('tooling/identity/rebrand.mjs')).toContain('staleBaselines(ROOT)');
    });

    it('has no retired name still present', () => {
      // `previousNames` grows on every rename; this must always be empty.
      expect(findPreviousNames(identity, ROOT)).toEqual([]);
      expect(read('tooling/setup/setup.config.json')).toContain('"previousNames"');
    });
  });
});
