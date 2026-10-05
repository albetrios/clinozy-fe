import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

/*
 * The print sheets' stylesheet (`print-template.css`) is generated from this
 * folder with Tailwind's DEFAULT theme only, and `src/index.css` leaves the
 * folder out of the main scan (L-54) — so a sheet's token utility
 * (`text-foreground`, `*:border-border-strong`) is generated only because the
 * main stylesheet has it: a screen spells it, or `index.css` lists it in its
 * `@source inline(…)`. Anything else would print unstyled; this holds the
 * sheets to that. It loads after the main stylesheet, so its utilities sit
 * in a layer beneath the main `utilities` — this holds that too.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '../../..');
const require = createRequire(import.meta.url);

/** `print-template.css` as the build generates it, for the given class names. */
async function compilePrintStylesheet(candidates: string[]): Promise<string> {
  const compiler = await compile(readFileSync(join(HERE, 'print-template.css'), 'utf8'), {
    base: HERE,
    loadStylesheet: async (id, base) => {
      const path = id.startsWith('tailwindcss/')
        ? require.resolve(`${id}.css`)
        : join(base, id);
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    },
  });
  return compiler.build(candidates);
}

/** A stylesheet's top-level rules: each one's prelude and its block (empty for a statement). */
function topLevelRules(css: string): { prelude: string; block: string }[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: { prelude: string; block: string }[] = [];
  let depth = 0;
  let start = 0;
  let open = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === ';' && depth === 0) {
      rules.push({ prelude: text.slice(start, index).trim(), block: '' });
      start = index + 1;
    } else if (char === '{') {
      if (depth === 0) open = index;
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        rules.push({
          prelude: text.slice(start, open).trim(),
          block: text.slice(open + 1, index),
        });
        start = index + 1;
      }
    }
  }
  return rules;
}

/** The source files under `dir`, tests and this folder left out where asked. */
function sources(dir: string, skip?: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (path === skip) return [];
    if (statSync(path).isDirectory()) return sources(path, skip);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/**
 * The utilities a sheet's class strings name without an arbitrary value —
 * `text-foreground`, `*:border-border` — from its string literals, less the
 * values of attributes other than `className` (`data-slot="print-sheet"`).
 * An arbitrary value (`w-[210mm]`) needs no theme, so it is not listed.
 */
function utilitiesIn(source: string): string[] {
  const classStrings = source.replace(/(?<!className)="[^"\n]*"/g, '');
  const literals = classStrings.match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g) ?? [];
  return literals
    .flatMap((literal) => literal.slice(1, -1).split(/\s+/))
    .filter((word) => /^(?:\*:)?[a-z]+(?:-[a-z0-9]+)+$/.test(word));
}

/** Utilities the default theme generates by itself — no app token behind them. */
const THEME_FREE = new Set([
  'border-separate',
  'border-spacing-0',
  'border-t',
  'border-b',
  'table-fixed',
  'table-row-group',
  'break-inside-avoid',
  'box-content',
  'inline-block',
  'whitespace-nowrap',
  'wrap-anywhere',
  'overflow-hidden',
  'text-start',
  'text-end',
  'text-center',
  'font-bold',
  'items-center',
  'justify-between',
  'flex-col',
  'w-full',
  'w-min',
]);

/** The utility without its `*:` variant. */
const baseOf = (utility: string) => utility.replace(/^\*:/, '');

describe('the print sheets’ stylesheet', () => {
  // The sheets themselves: their components carry every class the stylesheet needs.
  const sheets = sources(HERE)
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => ({
      file: relative(SRC, file),
      utilities: utilitiesIn(readFileSync(file, 'utf8')),
    }));
  // What the main stylesheet is generated from: the screens, and index.css's own list.
  const mainSources = [
    ...sources(SRC, HERE).map((file) => readFileSync(file, 'utf8')),
    readFileSync(join(SRC, 'index.css'), 'utf8'),
  ].join('\n');
  const spelled = (utility: string) => {
    const escaped = utility.replace(/[*]/g, '\\*');
    return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`).test(mainSources);
  };

  it('reads the sheets it guards', () => {
    expect(sheets.map((sheet) => sheet.file)).toEqual(
      expect.arrayContaining([
        'shared/components/PrintTemplate/PrintTemplate.tsx',
        'shared/components/PrintTemplate/InvoicePrint/InvoicePrint.tsx',
        'shared/components/PrintTemplate/PrescriptionPrint/PrescriptionPrint.tsx',
      ]),
    );
    const named = sheets.flatMap((sheet) => sheet.utilities);
    expect(named).toContain('text-foreground');
    expect(named).toContain('*:border-border-strong');
  });

  it('lays its utilities beneath the screens’ own, so a drawer keeps its width', async () => {
    // The main stylesheet's layer order is tailwindcss's own statement.
    const order = /@layer ([\w\s,-]+);/
      .exec(readFileSync(require.resolve('tailwindcss/index.css'), 'utf8'))?.[1]
      ?.split(',')
      .map((name) => name.trim());
    expect(order?.indexOf('components')).toBeLessThan(order?.indexOf('utilities') ?? -1);

    const rules = topLevelRules(await compilePrintStylesheet(['w-full', 'mt-[1.1mm]']));
    // No style outside a layer (`@property` only registers a property): an
    // unlayered `.w-full` outranked a record drawer's `md:w-[min(840px,…)]`
    // and filled the viewport.
    expect(rules.filter((rule) => !/^@(?:layer|property)\b/.test(rule.prelude))).toEqual(
      [],
    );
    const components = rules.find((rule) => rule.prelude === '@layer components');
    expect(components?.block).toMatch(/\.w-full\s*\{\s*width:\s*100%;/);
    expect(components?.block).toMatch(
      /\.mt-\\\[1\\\.1mm\\\]\s*\{\s*margin-top:\s*1\.1mm;/,
    );
  });

  it('uses a token utility only where the main stylesheet has it', () => {
    const printOnly = sheets.flatMap(({ file, utilities }) =>
      utilities
        .filter((utility) => !THEME_FREE.has(baseOf(utility)))
        .filter((utility) => !spelled(utility))
        .map((utility) => `${file}: ${utility}`),
    );
    expect(printOnly).toEqual([]);
  });
});
