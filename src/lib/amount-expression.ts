/**
 * Sums typed into a number field (feat-write-less-2026-10-14-oixr, D9): `1500+300`, `2000-150`,
 * `3x500` (or `3*500`, `3×500`), `4500/3`, and the shorthands `1.5k` (1,500) and `2L` / `2 lakh` /
 * `2 lac` (2,00,000). Read by a small scanner and two precedence levels — never `eval`.
 */

/** The shorthands a figure may end in, and what each multiplies it by. */
const UNIT_FACTORS: Readonly<Record<string, number>> = {
  k: 1_000,
  l: 100_000,
  lac: 100_000,
  lakh: 100_000,
  lakhs: 100_000,
};

type Operator = '+' | '-' | '*' | '/';
type Token = number | Operator;

const OPERATORS: Readonly<Record<string, Operator>> = {
  '+': '+',
  '-': '-',
  '*': '*',
  x: '*',
  '×': '*',
  '/': '/',
  '÷': '/',
};

const isDigit = (char: string) => char >= '0' && char <= '9';
const isLetter = (char: string) => char >= 'a' && char <= 'z' && char !== 'x';

/** One figure from `index`: digits with at most one point, then an optional shorthand. */
function readFigure(
  source: string,
  start: number,
): { value: number; end: number } | null {
  let index = start;
  let point = false;
  while (index < source.length) {
    const char = source.charAt(index);
    if (char === '.' && !point) point = true;
    else if (!isDigit(char)) break;
    index += 1;
  }
  const figure = source.slice(start, index);
  if (!/\d/.test(figure)) return null;
  const unitStart = index;
  while (index < source.length && isLetter(source.charAt(index))) index += 1;
  const unit = source.slice(unitStart, index);
  const factor = unit ? UNIT_FACTORS[unit] : 1;
  if (factor === undefined) return null;
  return { value: Number(figure) * factor, end: index };
}

/** The tokens of a sum, or `null` for a character it cannot read. */
function tokenize(text: string): Token[] | null {
  const source = text.toLowerCase().replace(/[\s,₹]/g, '');
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const operator = OPERATORS[source.charAt(index)];
    if (operator) {
      tokens.push(operator);
      index += 1;
      continue;
    }
    const figure = readFigure(source, index);
    if (!figure) return null;
    tokens.push(figure.value);
    index = figure.end;
  }
  return tokens;
}

/**
 * The value of a typed sum — figure (operator figure)*, `×` and `/` before `+` and `-` — or `null`
 * when it does not work out: a dangling operator (`12+`), two operators in a row, a leading sign,
 * an unknown shorthand, division by zero or a result that is not a finite number.
 *
 * @param text - What was typed; spaces, commas and "₹" are ignored.
 * @returns The result, unrounded, or `null`.
 */
export function evaluateAmountExpression(text: string): number | null {
  const tokens = tokenize(text);
  const first = tokens?.[0];
  if (!tokens || typeof first !== 'number') return null;
  let total = 0;
  let term = first;
  for (let index = 1; index < tokens.length; index += 2) {
    const operator = tokens[index];
    const figure = tokens[index + 1];
    if (typeof operator !== 'string' || typeof figure !== 'number') return null;
    if (operator === '*') term *= figure;
    else if (operator === '/') {
      if (figure === 0) return null;
      term /= figure;
    } else {
      total += term;
      term = operator === '+' ? figure : -figure;
    }
  }
  const result = total + term;
  return Number.isFinite(result) ? result : null;
}

/**
 * Text that is a sum or a shorthand rather than a plain figure: an operator anywhere, or a figure
 * followed by `k` or `l` (lakh, lac). Other letters are not — a field drops them as before.
 */
export function isAmountExpression(text: string): boolean {
  const source = text.replace(/[\s,₹]/g, '');
  return /[+\-*/x×÷]/i.test(source) || /\d[kl]/i.test(source);
}
