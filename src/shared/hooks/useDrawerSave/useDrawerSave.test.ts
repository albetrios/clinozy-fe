import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/shared/errors/HttpError.ts';

import { useDrawerSave, type UseDrawerSaveOptions } from './useDrawerSave.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { error: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

interface Values {
  name: string;
  price: string;
}

type Options = Partial<UseDrawerSaveOptions<Values, string>>;

function render(options: Options = {}) {
  const onField = vi.fn();
  const onDone = vi.fn();
  const write = options.write ?? vi.fn().mockResolvedValue('saved');
  const view = renderHook(() => {
    const form = useForm<Values>({ defaultValues: { name: 'Peel', price: '900' } });
    return {
      form,
      ...useDrawerSave<Values, string>({
        form,
        fieldOrder: ['name', 'price'],
        onField,
        write,
        onDone,
        toastId: 'test-save-failed',
        ...options,
      }),
    };
  });
  return { ...view, onField, onDone, write };
}

/** A clinozy-be refusal with field messages. */
const refusal = (status: 409 | 422, fields: Record<string, string[]>) =>
  new HttpError('refused', status, '/x', 'POST', {
    error: { type: 'request_error', code: 'validation', detail: 'refused', fields },
  });

beforeEach(() => {
  notifyMock.error.mockReset();
  notifyMock.warning.mockReset();
});

describe('useDrawerSave', () => {
  it('writes, hands the outcome on and stays "saving" for the close', async () => {
    const { result, onDone } = render();
    await act(() => result.current.save(true));
    expect(onDone).toHaveBeenCalledWith('saved', true);
    expect(result.current.saveState).toBe('saving');
  });

  it('stops on a client rule: outlines its field, opens its step, toasts', async () => {
    const { result, onField, write } = render({
      check: () => ({ fields: ['price'], message: 'Add a price' }),
    });
    await act(() => result.current.save());
    expect(write).not.toHaveBeenCalled();
    expect(onField).toHaveBeenCalledWith('price');
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a price');
    expect(result.current.form.getFieldState('price').error?.message).toBe('Add a price');
    expect(result.current.saveState).toBe('idle');
  });

  it('maps a validation error onto its first field, through the server’s spelling', async () => {
    const { result, onField } = render({
      serverFields: { listPrice: 'price' },
      write: vi.fn().mockRejectedValue(refusal(422, { listPrice: ['Too high'] })),
    });
    await act(() => result.current.save());
    expect(onField).toHaveBeenCalledWith('price');
    expect(notifyMock.error).toHaveBeenCalledWith('Too high');
    expect(result.current.saveState).toBe('idle');
  });

  it('hands a conflict to the screen', async () => {
    const onConflict = vi.fn();
    const { result } = render({
      onConflict,
      write: vi.fn().mockRejectedValue(refusal(409, { name: ['Taken'] })),
    });
    await act(() => result.current.save());
    expect(onConflict).toHaveBeenCalledWith(expect.any(HttpError));
    expect(notifyMock.error).not.toHaveBeenCalled();
  });

  it('keeps the draft on a dropped connection, with "Retry"', async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue('saved');
    const { result, onDone } = render({ write });
    await act(() => result.current.save());
    expect(result.current.saveState).toBe('failed');
    const [, options] = notifyMock.error.mock.lastCall as [
      string,
      { id: string; action: { onClick: () => void } },
    ];
    expect(options.id).toBe('test-save-failed');
    await act(async () => options.action.onClick());
    expect(onDone).toHaveBeenCalledWith('saved', false);
  });
  // The fetch client surfaces a dropped connection as status 0 — a failure, not a refusal.
  it('keeps the draft with "Retry" when the fetch client reports the connection dropped (status 0)', async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(new HttpError('Failed to fetch', 0, '/x', 'POST'))
      .mockResolvedValue('saved');
    const { result, onDone } = render({ write });
    await act(() => result.current.save());
    expect(result.current.saveState).toBe('failed');
    const [, options] = notifyMock.error.mock.lastCall as [
      string,
      { id: string; action: { onClick: () => void } },
    ];
    expect(options.id).toBe('test-save-failed');
    await act(async () => options.action.onClick());
    expect(onDone).toHaveBeenCalledWith('saved', false);
  });
});
