import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { errorMock } = vi.hoisted(() => ({ errorMock: vi.fn() }));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: errorMock, warning: vi.fn(), info: vi.fn() },
}));

import { HttpError } from '@/shared/errors/HttpError.ts';

import { useDrawerSave } from './useDrawerSave.ts';

interface Values {
  firstName: string;
  notes: string;
}

const refusal = (status: number, error: Record<string, unknown>) =>
  new HttpError(`HTTP ${status}`, status, '/api/v1/app/leads/lead_x', 'PATCH', { error });

function renderSave(options: {
  write: () => Promise<string>;
  onStale?: () => void;
  onConflict?: (error: HttpError) => void;
}) {
  const onField = vi.fn();
  const onDone = vi.fn();
  const view = renderHook(() => {
    const form = useForm<Values>({ defaultValues: { firstName: '', notes: '' } });
    return {
      form,
      drawer: useDrawerSave<Values, string>({
        form,
        fieldOrder: ['firstName', 'notes'],
        onField,
        onDone,
        toastId: 'lead-save',
        ...options,
      }),
    };
  });
  return { ...view, onField, onDone };
}

describe('useDrawerSave', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('a stale save toasts our own words — never the server’s user id and time — with Reload, which loads the record again', async () => {
    const onStale = vi.fn();
    const onConflict = vi.fn();
    const { result } = renderSave({
      write: () =>
        Promise.reject(
          refusal(409, {
            type: 'request_error',
            code: 'conflict',
            reason: 'record_changed',
            detail:
              'This record was changed by usr_kb5tlncpzg38oat3s7nv7 at 2026-10-10T11:45:34.719Z — reload and try again',
          }),
        ),
      onStale,
      onConflict,
    });

    await act(() => result.current.drawer.save());

    expect(result.current.drawer.saveState).toBe('idle');
    expect(onConflict).not.toHaveBeenCalled();
    const [message, options] = errorMock.mock.calls[0] as [
      string,
      { id: string; action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe(
      'Someone else saved this meanwhile. Reload to see their changes, then make yours again.',
    );
    expect(message).not.toMatch(/usr_|\d{4}-\d{2}-\d{2}T/);
    expect(options.id).toBe('lead-save');
    expect(options.action.label).toBe('Reload');
    options.action.onClick();
    expect(onStale).toHaveBeenCalledOnce();
  });

  it('a stale save without onStale toasts with no action', async () => {
    const { result } = renderSave({
      write: () =>
        Promise.reject(
          refusal(409, { reason: 'record_changed', detail: 'Changed meanwhile' }),
        ),
    });

    await act(() => result.current.drawer.save());

    expect(errorMock).toHaveBeenCalledWith(
      'Someone else saved this meanwhile. Reload to see their changes, then make yours again.',
      { id: 'lead-save' },
    );
  });

  it("another 409 still goes to the screen's onConflict", async () => {
    const onConflict = vi.fn();
    const conflict = refusal(409, {
      reason: 'contact_phone_exists',
      detail: 'Number taken',
    });
    const { result } = renderSave({ write: () => Promise.reject(conflict), onConflict });

    await act(() => result.current.drawer.save());

    expect(onConflict).toHaveBeenCalledWith(conflict);
    expect(errorMock).not.toHaveBeenCalled();
  });

  it("a 400 puts the server's messages on the form's fields and opens the first", async () => {
    const { result, onField } = renderSave({
      write: () =>
        Promise.reject(
          refusal(400, {
            type: 'validation_error',
            detail: 'Check the fields',
            errors: [
              { field: 'notes', message: 'Too long' },
              { field: 'first_name', message: 'Required' },
            ],
          }),
        ),
    });

    await act(() => result.current.drawer.save());

    expect(result.current.form.getFieldState('firstName').error?.message).toBe(
      'Required',
    );
    expect(result.current.form.getFieldState('notes').error?.message).toBe('Too long');
    expect(onField).toHaveBeenCalledWith('firstName');
    expect(errorMock).toHaveBeenCalledWith('Required');
  });
});
