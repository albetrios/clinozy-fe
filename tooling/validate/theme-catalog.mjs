#!/usr/bin/env node
/**
 * Ensures design/theming docs list the same theme axis options as presets.ts.
 * Source of truth: src/shared/theme/catalog-doc.ts (derived from presets.ts).
 *
 * Run from project root: pnpm validate:theme-catalog
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../..');

const failures = [];

function fail(message) {
  failures.push(message);
}

async function main() {
  const { THEME_DOC_ASSERTIONS } = await import(
    join(ROOT, 'src/shared/theme/catalog-doc.ts')
  );

  for (const [relPath, assertions] of Object.entries(THEME_DOC_ASSERTIONS)) {
    const absPath = join(ROOT, relPath);
    let content;
    try {
      content = readFileSync(absPath, 'utf8');
    } catch {
      fail(`Missing doc file: ${relPath}`);
      continue;
    }

    for (const assertion of assertions) {
      for (const token of assertion.mustInclude) {
        if (!content.includes(token)) {
          fail(`${relPath} — ${assertion.label}: missing option "${token}"`);
        }
      }
      for (const stale of assertion.mustExclude ?? []) {
        if (content.includes(stale)) {
          fail(`${relPath} — ${assertion.label}: stale catalog text "${stale}"`);
        }
      }
    }
  }

  if (failures.length > 0) {
    console.error('Theme catalog doc drift:\n');
    for (const message of failures) {
      console.error(`  • ${message}`);
    }
    console.error(
      '\nFix docs to match src/shared/theme/presets.ts (see theme-axis-audit-playbook.md).',
    );
    process.exit(1);
  }

  console.log('Theme catalog docs match presets.ts');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
