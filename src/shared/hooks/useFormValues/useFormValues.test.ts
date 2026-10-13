import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { useFormValues } from './useFormValues.ts';

interface Values {
  name: string;
  count: number;
}

function useValuesOfForm() {
  const form = useForm<Values>({ defaultValues: { name: 'Riya', count: 1 } });
  return { form, values: useFormValues(form) };
}

describe('useFormValues', () => {
  it('starts with every default value', () => {
    const { result } = renderHook(useValuesOfForm);
    expect(result.current.values).toEqual({ name: 'Riya', count: 1 });
  });

  it('follows each change and keeps the keys that did not change', () => {
    const { result } = renderHook(useValuesOfForm);
    act(() => result.current.form.setValue('count', 3));
    expect(result.current.values).toEqual({ name: 'Riya', count: 3 });
    act(() => result.current.form.reset({ name: 'Kiran', count: 0 }));
    expect(result.current.values).toEqual({ name: 'Kiran', count: 0 });
  });
});
