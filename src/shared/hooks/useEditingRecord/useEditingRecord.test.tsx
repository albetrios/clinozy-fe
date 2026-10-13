import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { notifyError } = vi.hoisted(() => ({ notifyError: vi.fn() }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: { error: notifyError } }));

import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { useEditingRecord } from './useEditingRecord.ts';

interface Patient {
  id: string;
  notes: string;
}

interface Values {
  notes: string;
}

const ORGANIZATION = 'org_aaaaaaaaaaaaaaaaaaaaa';
const OPENED: Patient = { id: 'pat_one', notes: 'Saved' };
const THEIRS: Patient = { id: 'pat_one', notes: 'Theirs' };
const keyOf = (organizationId: string | null, id: string) => [
  'patients',
  organizationId,
  id,
];

/** The app's compiled `<textarea {...form.register('notes')} />`: registered once, kept. */
function MemoizedNotes({ form }: { form: UseFormReturn<Values> }) {
  const [registration] = useState(() => form.register('notes'));
  return <textarea aria-label="Notes" {...registration} />;
}

function renderEditing(opened: Patient | null, queryFn: () => Promise<Patient>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keyOf(ORGANIZATION, 'pat_one'), OPENED);
  const read = vi.fn((patient: Patient, organizationId: string | null) => ({
    queryKey: keyOf(organizationId, patient.id),
    queryFn,
  }));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () => {
      const form = useForm<Values>({ defaultValues: { notes: opened?.notes ?? '' } });
      const editing = useEditingRecord({
        record: opened,
        form,
        formOf: (patient) => ({ notes: patient.notes }),
        read,
      });
      return { form, ...editing };
    },
    { wrapper },
  );
  render(<MemoizedNotes form={hook.result.current.form} />);
  return {
    result: hook.result,
    read,
    notes: screen.getByLabelText<HTMLTextAreaElement>('Notes'),
  };
}

describe('useEditingRecord', () => {
  beforeEach(() => {
    useOrganizationStore.setState({ organizationId: ORGANIZATION });
  });
  afterEach(() => {
    vi.resetAllMocks();
    useOrganizationStore.setState({ organizationId: null });
  });

  it('reads the record again past the cache and starts the form over on it, inputs included', async () => {
    const queryFn = vi.fn(() => Promise.resolve(THEIRS));
    const { result, read, notes } = renderEditing(OPENED, queryFn);
    const user = userEvent.setup();
    await user.clear(notes);
    await user.type(notes, 'Typed');

    await act(() => result.current.reload());

    expect(read).toHaveBeenCalledWith(OPENED, ORGANIZATION);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(result.current.record).toEqual(THEIRS);
    expect(result.current.form.getValues('notes')).toBe('Theirs');
    // What the screen shows is what the next save sends.
    expect(notes.value).toBe('Theirs');
    await user.type(notes, ' and mine');
    expect(result.current.form.getValues('notes')).toBe('Theirs and mine');
  });

  it('a read that fails says why and leaves the record and the form as they were', async () => {
    const failure = new Error('offline');
    const { result, notes } = renderEditing(OPENED, () => Promise.reject(failure));

    await act(() => result.current.reload());

    expect(notifyError).toHaveBeenCalledWith(mapApiError(failure));
    expect(result.current.record).toEqual(OPENED);
    expect(notes.value).toBe('Saved');
  });

  it('a new record has nothing to reload', async () => {
    const queryFn = vi.fn(() => Promise.resolve(THEIRS));
    const { result, read } = renderEditing(null, queryFn);

    await act(() => result.current.reload());

    expect(read).not.toHaveBeenCalled();
    expect(result.current.record).toBeNull();
  });
});
