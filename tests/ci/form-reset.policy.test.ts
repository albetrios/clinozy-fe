import { globSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * No bare react-hook-form `reset` in app code — every restart of a mounted form goes through
 * `resetFormInPlace` (`src/shared/hooks/useEditingRecord/reset-form-in-place.ts`).
 *
 * Under React Compiler the JSX spreading `register(…)` is memoized for the form's life, so an
 * input never registers again. A bare `reset(values)` drops react-hook-form's field refs: the
 * input keeps showing what was typed while the form holds the new value, and what is typed next
 * never reaches the form — the save sends a value the screen does not show. Vitest runs without
 * the compiler, so no component test can catch it; this scan does.
 *
 * Two shapes are refused: a `reset` destructured from `useForm(…)`, and a `<name>Form.reset(` /
 * `form.reset(` call. The helper itself is the one file allowed to call `form.reset`.
 */

const HELPER = 'src/shared/hooks/useEditingRecord/reset-form-in-place.ts';

/** A destructuring of `useForm(...)` — its names, one level of nested braces allowed. */
const USE_FORM_DESTRUCTURING = /const\s*\{((?:[^{}]|\{[^{}]*\})*)\}\s*=\s*useForm\b/g;

/** Whether `text` takes a `reset` out of `useForm(...)` by destructuring. */
function destructuresReset(text: string): boolean {
  // `reset` taken as itself, or renamed (`reset: restart`).
  return [...text.matchAll(USE_FORM_DESTRUCTURING)].some(([, names]) =>
    /\breset\b(?!\s*:)|\breset\s*:/.test(names ?? ''),
  );
}

/** A reset called on the form object (`form.reset(`, `inviteForm.reset(`). */
const FORM_RESET_CALL = /\b(?:form|\w+Form)\.reset\(/;

/** App source — tests are free to show the trap (the helper's own test does). */
function appSources(): string[] {
  return globSync('src/**/*.{ts,tsx}').filter(
    (path) => !/\.test\.tsx?$/.test(path) && path !== HELPER,
  );
}

describe('form restarts go through resetFormInPlace', () => {
  it('catches both shapes it refuses — the scan is not inert', () => {
    expect(
      destructuresReset(
        'const {\n  register,\n  reset,\n  formState: { errors },\n} = useForm<X>({});',
      ),
    ).toBe(true);
    expect(
      destructuresReset(
        'const {\n  register,\n  formState: { errors },\n} = useForm<X>({});',
      ),
    ).toBe(false);
    expect(FORM_RESET_CALL.test('    form.reset(values);')).toBe(true);
    expect(FORM_RESET_CALL.test('    inviteForm.reset();')).toBe(true);
    expect(FORM_RESET_CALL.test('    resetFormInPlace(form, values);')).toBe(false);
    expect(FORM_RESET_CALL.test('    query.reset();')).toBe(false);
  });

  it('finds no bare reset of a react-hook-form form in app code', () => {
    const sources = appSources();
    expect(sources.length).toBeGreaterThan(500);
    const offenders = sources.filter((path) => {
      const text = readFileSync(path, 'utf8');
      return destructuresReset(text) || FORM_RESET_CALL.test(text);
    });
    expect(offenders).toEqual([]);
  });
});
