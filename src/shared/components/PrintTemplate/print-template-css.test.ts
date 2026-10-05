import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/*
 * The print sheets' stylesheet (`print-template.css`) is generated from this
 * folder with Tailwind's DEFAULT theme only, and `src/index.css` leaves the
 * folder out of the main scan (L-54) — so a sheet's token utility
 * (`text-foreground`, `*:border-border-strong`) is generated only because the
 * main stylesheet has it: a screen spells it, or `index.css` lists it in its
 * `@source inline(…)`. Anything else would print unstyled; this holds the
 * sheets to that.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '../../..');

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
