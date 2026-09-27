/**
 * Security tripwire: app code must contain no raw HTML/JS injection sinks.
 *
 * React escapes interpolated content by default, and the app ships a CSP — but
 * a single `dangerouslySetInnerHTML`, `el.innerHTML = …`, `insertAdjacentHTML`,
 * `document.write`, or `eval(` reopens an XSS hole that escaping/CSP may not
 * fully cover. This scans every committed app source file (via Vite's raw glob)
 * and fails loudly if a sink appears. Vendored `components/ui/` and test files
 * are out of scope; comments are stripped so docs that *mention* a sink don't
 * trip it.
 */
import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('../../src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const SINKS: ReadonlyArray<readonly [string, RegExp]> = [
  ['dangerouslySetInnerHTML', /dangerouslySetInnerHTML/],
  ['innerHTML assignment', /\.innerHTML\s*=/],
  ['outerHTML assignment', /\.outerHTML\s*=/],
  ['insertAdjacentHTML', /insertAdjacentHTML/],
  ['document.write', /document\s*\.\s*write/],
  ['eval', /\beval\s*\(/],
  ['new Function', /\bnew\s+Function\s*\(/],
];

function stripComments(code: string): string {
  // Plain index scan — regex comment matchers all trip sonarjs/super-linear-regex.
  let out = '';
  let i = 0;
  while (i < code.length) {
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? code.length : end + 2;
    } else if (code.startsWith('//', i)) {
      const newline = code.indexOf('\n', i);
      i = newline === -1 ? code.length : newline;
    } else {
      out += code[i];
      i += 1;
    }
  }
  return out;
}

/** Allowlisted sinks — locally generated SVG only; data is never user HTML. */
const ALLOWLISTED_SINKS: ReadonlyArray<string> = [
  '../../src/shared/components/QrCode/QrCode.tsx',
];

describe('XSS sink tripwire', () => {
  it('app source contains no raw HTML/JS injection sinks', () => {
    const offenders: string[] = [];
    for (const [path, code] of Object.entries(sources)) {
      if (path.includes('.test.') || path.includes('/components/ui/')) continue;
      if (ALLOWLISTED_SINKS.includes(path)) continue;
      const stripped = stripComments(code);
      for (const [label, pattern] of SINKS) {
        if (pattern.test(stripped)) offenders.push(`${path} → ${label}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('actually scanned a meaningful number of source files', () => {
    // Guards against a glob that silently matches nothing (which would make the
    // tripwire vacuously pass).
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });
});
