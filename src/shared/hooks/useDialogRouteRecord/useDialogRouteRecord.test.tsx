import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appHttpError } from '@/shared/api/app/app-fixture-store.ts';

import { useDialogRouteRecord } from './useDialogRouteRecord.ts';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { info: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const RECORDS: Record<string, { id: string; name: string }> = {
  l1: { id: 'l1', name: 'Rhea' },
};

const attempts = { down: 0 };

async function fetchRecord(id: string) {
  if (id === 'down') {
    attempts.down += 1;
    if (attempts.down <= 3) throw appHttpError(503, 'unavailable', 'Try again');
    return { id, name: 'Back' };
  }
  const record = RECORDS[id];
  if (!record) throw appHttpError(404, 'not_found', 'Lead not found');
  return record;
}

function renderRecord(
  id: string | undefined,
  onMissing = vi.fn(),
  isWellFormed?: (id: string) => boolean,
) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const read = vi.fn(fetchRecord);
  const hook = renderHook(
    (props: { id: string | undefined }) =>
      useDialogRouteRecord({
        id: props.id,
        queryKey: (key) => ['lead', key],
        fetchRecord: read,
        recordLabel: 'Lead',
        onMissing,
        isWellFormed,
      }),
    { wrapper, initialProps: { id } },
  );
  return { ...hook, onMissing, read };
}

beforeEach(() => notifyMock.info.mockReset());

describe('useDialogRouteRecord', () => {
  it('stays closed while the dialog route is not matched', () => {
    const { result } = renderRecord(undefined);
    expect(result.current).toMatchObject({
      record: undefined,
      isOpen: false,
      isPending: false,
      isError: false,
    });
  });

  it('opens on a known record', async () => {
    const { result } = renderRecord('l1');
    expect(result.current.isOpen).toBe(true);
    await waitFor(() => expect(result.current.record).toEqual(RECORDS.l1));
  });

  it('closes, toasts once and leaves for the parent on an unknown id', async () => {
    const { result, onMissing, rerender } = renderRecord('gone');
    await waitFor(() => expect(onMissing).toHaveBeenCalledTimes(1));
    expect(result.current.isOpen).toBe(false);
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Lead not found · it may have been deleted',
    );
    rerender({ id: 'gone' });
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
  });

  it('turns an id `isWellFormed` refuses away as not found, toasting once, without a read', async () => {
    const isLead = (id: string) => id.startsWith('l');
    const { result, onMissing, read, rerender } = renderRecord(
      '3f2a8c1e-uuid',
      vi.fn(),
      isLead,
    );
    await waitFor(() => expect(onMissing).toHaveBeenCalledTimes(1));
    expect(result.current).toMatchObject({
      isOpen: false,
      isPending: false,
      isError: false,
    });
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Lead not found · it may have been deleted',
    );
    rerender({ id: '3f2a8c1e-uuid' });
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    expect(read).not.toHaveBeenCalled();

    rerender({ id: 'l1' });
    await waitFor(() => expect(result.current.record).toEqual(RECORDS.l1));
    expect(read).toHaveBeenCalledWith('l1');
  });

  it('reports another failure as an error, stays open and reads again on refetch', async () => {
    attempts.down = 0;
    const { result, onMissing } = renderRecord('down');
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 });
    expect(result.current.isOpen).toBe(true);
    expect(onMissing).not.toHaveBeenCalled();
    result.current.refetch();
    await waitFor(() =>
      expect(result.current.record).toEqual({ id: 'down', name: 'Back' }),
    );
    expect(result.current.isError).toBe(false);
  });
});
