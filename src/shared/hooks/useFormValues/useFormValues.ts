import { type FieldValues, type UseFormReturn, useWatch } from 'react-hook-form';

/**
 * A react-hook-form form's values as they stand, every key present: the
 * watched values re-render the caller on each change, and the form's own
 * values fill any key not reported yet (a drawer's form starts with all of
 * them). Drawers read it for their live summary, badges and step peeks.
 */
export function useFormValues<TValues extends FieldValues>(
  form: UseFormReturn<TValues>,
): TValues {
  const watched = useWatch({ control: form.control });
  return { ...form.getValues(), ...watched } as TValues;
}
