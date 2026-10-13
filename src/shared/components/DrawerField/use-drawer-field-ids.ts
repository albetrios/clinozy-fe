import {
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
  useFormState,
} from 'react-hook-form';

import { drawerFieldErrorId } from './drawer-field-controls.ts';

/** A form field's control wiring: its DOM id, its error and the attributes that tie them. */
export interface DrawerFieldIds {
  id: string;
  error: string | undefined;
  control: {
    id: string;
    'aria-invalid': true | undefined;
    'aria-describedby': string | undefined;
  };
}

/**
 * The ids a drawer form's controls carry: `<idPrefix>-<field>`, the field's
 * error message (a client check's or the server's), and `aria-invalid` /
 * `aria-describedby` pointing at the `DrawerField` error under it.
 */
export function useDrawerFieldIds<T extends FieldValues>(
  form: UseFormReturn<T>,
  idPrefix: string,
): (name: FieldPath<T>) => DrawerFieldIds {
  const formState = useFormState({ control: form.control });
  return (name) => {
    const id = `${idPrefix}-${name}`;
    const message = form.getFieldState(name, formState).error?.message;
    const error = typeof message === 'string' && message ? message : undefined;
    return {
      id,
      error,
      control: {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? drawerFieldErrorId(id) : undefined,
      },
    };
  };
}
