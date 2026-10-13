import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import {
  type FieldPath,
  useForm,
  type UseFormReturn,
  useFormState,
} from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { resetFormInPlace } from './reset-form-in-place.ts';

interface Values {
  notes: string;
  contact: { city: string };
  status: string;
}

const SAVED: Values = { notes: 'Saved', contact: { city: 'Surat' }, status: 'new' };

/**
 * What React Compiler makes of `<input {...form.register(name)} />` in the app: the props — the
 * ref callback with them — are made once and kept while `form` (one object for the form's life)
 * stays the same, so the input never registers again. Vitest runs without the compiler
 * (`vitest.config.ts`), so the test keeps them by hand, in a root of their own the form never
 * re-renders.
 */
function MemoizedInput({
  form,
  name,
}: {
  form: UseFormReturn<Values>;
  name: FieldPath<Values>;
}) {
  const [registration] = useState(() => form.register(name));
  return <input aria-label={name} {...registration} />;
}

function renderForm() {
  const hook = renderHook(() => {
    const form = useForm<Values>({ defaultValues: SAVED });
    const { isDirty, errors } = useFormState({ control: form.control });
    return { form, isDirty, errors };
  });
  const form = hook.result.current.form;
  render(
    <>
      <MemoizedInput form={form} name="notes" />
      <MemoizedInput form={form} name="contact.city" />
    </>,
  );
  return {
    form,
    state: () => hook.result.current,
    notes: screen.getByLabelText<HTMLInputElement>('notes'),
    city: screen.getByLabelText<HTMLInputElement>('contact.city'),
  };
}

async function retype(input: HTMLInputElement, text: string) {
  const user = userEvent.setup();
  await user.clear(input);
  await user.type(input, text);
}

describe('resetFormInPlace', () => {
  it('guards against a bare reset, which leaves the input on what was typed and deaf after it', async () => {
    const { form, notes } = renderForm();
    await retype(notes, 'Typed');

    act(() => form.reset({ ...SAVED, notes: 'Theirs' }));

    // The trap the helper exists for — if react-hook-form ever stops dropping its field refs on
    // a reset, this fails and the helper can be revisited.
    expect(form.getValues('notes')).toBe('Theirs');
    expect(notes.value).toBe('Typed');
    await userEvent.setup().type(notes, ' more');
    expect(form.getValues('notes')).toBe('Theirs');
  });

  it('shows the new values in the inputs, nested ones too', async () => {
    const { form, notes, city } = renderForm();
    await retype(notes, 'Typed');
    await retype(city, 'Pune');

    act(() =>
      resetFormInPlace(form, {
        notes: 'Theirs',
        contact: { city: 'Vapi' },
        status: 'new',
      }),
    );

    expect(notes.value).toBe('Theirs');
    expect(city.value).toBe('Vapi');
    expect(form.getValues()).toEqual({
      notes: 'Theirs',
      contact: { city: 'Vapi' },
      status: 'new',
    });
  });

  it('keeps the inputs reaching the form: what is typed next is what the form holds', async () => {
    const { form, notes } = renderForm();
    await retype(notes, 'Typed');

    act(() => resetFormInPlace(form, { ...SAVED, notes: 'Theirs' }));
    await userEvent.setup().type(notes, ' more');

    expect(notes.value).toBe('Theirs more');
    expect(form.getValues('notes')).toBe('Theirs more');
  });

  it('shows a second restart too — the one `keepFieldsRef` alone leaves on the screen before it', async () => {
    const { form, notes } = renderForm();
    act(() => resetFormInPlace(form, { ...SAVED, notes: 'Theirs' }));
    await userEvent.setup().type(notes, ' more');

    act(() => resetFormInPlace(form, { ...SAVED, notes: 'Theirs again' }));

    expect(notes.value).toBe('Theirs again');
    expect(form.getValues('notes')).toBe('Theirs again');
  });

  it('starts the form over clean, or — for a fill — keeps where it started and its errors', () => {
    const { form, state } = renderForm();
    act(() => form.setError('notes', { type: 'server', message: 'Too long' }));

    act(() =>
      resetFormInPlace(
        form,
        { ...SAVED, status: 'follow_up' },
        { keepDefaultValues: true, keepErrors: true },
      ),
    );
    expect(state().isDirty).toBe(true);
    expect(state().errors.notes?.message).toBe('Too long');

    act(() => resetFormInPlace(form, SAVED));
    expect(state().isDirty).toBe(false);
    expect(state().errors.notes).toBeUndefined();
  });
});
