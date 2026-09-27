import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { toCsv } from './csv.ts';

// Property-based coverage of the security-critical CSV escaping: over thousands
// of strings mixing every dangerous character (formula triggers, quotes, commas,
// newlines) assert that quoting round-trips losslessly and that formula
// injection is always neutralized — invariants independent of the escaping code.

const TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

// Build cells from an explicit alphabet so the special characters actually
// appear (fc.string()'s default printable-ASCII set omits \n\r\t).
const CELL_CHARS = [
  '=',
  '+',
  '-',
  '@',
  '\t',
  '\r',
  '\n',
  '"',
  ',',
  ' ',
  "'",
  'x',
  '1',
  'ü',
];
const cellArb = fc
  .array(fc.constantFrom(...CELL_CHARS), { maxLength: 14 })
  .map((cs) => cs.join(''));

const startsWithTrigger = (str: string): boolean =>
  str.length > 0 && TRIGGERS.includes(str[0] ?? '');

// The oracle: a defused cell is the input with a leading apostrophe iff it began
// with a formula trigger.
const defuse = (str: string): string => (startsWithTrigger(str) ? `'${str}` : str);

// A single-column CSV's data line IS escapeField(cell) — slice off the known
// "h\n" header prefix to recover the escaped field without a full CSV parser.
const escapedCell = (cell: string): string => toCsv(['h'], [[cell]]).slice('h\n'.length);

// Reverse RFC4180 field quoting (only genuine wrapped fields start with `"`,
// since any embedded quote forces the field to be wrapped).
const unquoteField = (field: string): string =>
  field.length >= 2 && field.startsWith('"') && field.endsWith('"')
    ? field.slice(1, -1).replace(/""/g, '"')
    : field;

describe('toCsv — property based', () => {
  it('quoting is lossless: unescaping recovers the formula-defused input', () => {
    fc.assert(
      fc.property(cellArb, (cell) => {
        expect(unquoteField(escapedCell(cell))).toBe(defuse(cell));
      }),
    );
  });

  it('formula injection is always neutralized (no cell begins with a raw trigger)', () => {
    fc.assert(
      fc.property(cellArb, (cell) => {
        const inner = unquoteField(escapedCell(cell));
        expect(TRIGGERS.includes(inner[0] ?? '')).toBe(false);
      }),
    );
  });

  it('a cell containing a quote, comma, or newline is RFC4180-quoted', () => {
    fc.assert(
      fc.property(cellArb, (cell) => {
        const field = escapedCell(cell);
        if (/[",\n]/.test(defuse(cell))) {
          expect(field.startsWith('"') && field.endsWith('"')).toBe(true);
        }
      }),
    );
  });
});
