import type { FieldValues, KeepStateOptions, Path, UseFormReturn } from 'react-hook-form';

/** What a restart may keep: the starting values (a fill stays "changed") and the errors shown. */
export type ResetInPlaceOptions = Pick<
  KeepStateOptions,
  'keepDefaultValues' | 'keepErrors'
>;

/**
 * Restart a mounted form on new values — a drawer's "Reload" (the record read again) and every
 * fill that replaces several fields at once (Quick fill, a template, a picked bill).
 *
 * A bare `form.reset(values)` drops react-hook-form's field refs and leaves the inputs alone,
 * counting on each `register`-ed input to register again on the next render. Under React
 * Compiler it never does: the JSX spreading `form.register(…)` is memoized on `form`, one object
 * for the form's life. The input then keeps showing what was typed while the form holds the new
 * value, and whatever is typed next never reaches the form — the screen lies and the save sends
 * the form's value. `keepFieldsRef` keeps the refs, so typing keeps reaching the form; each value
 * is then written through them, because the reset writes only the names registered since the
 * previous reset — after the first, none of the memoized ones.
 */
export function resetFormInPlace<TValues extends FieldValues>(
  form: UseFormReturn<TValues>,
  values: TValues,
  options: ResetInPlaceOptions = {},
): void {
  form.reset(values, { ...options, keepFieldsRef: true });
  for (const [name, value] of Object.entries(values)) {
    form.setValue(name as Path<TValues>, value);
  }
}
