import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicHttpError } from '@/shared/api/clinic/clinic-fixture-store.ts';

import { useDialogRouteRecord } from './useDialogRouteRecord.ts';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { info: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const RECORDS: Record<string, { id: string; name: string }> = {
  l1: { id: 'l1', name: 'Rhea' },
};

async function fetchRecord(id: string) {
  const record = RECORDS[id];
  if (!record) throw clinicHttpError(404, 'not_found', 'Lead not found');
  return record;
}

function renderRecord(id: string | undefined, onMissing = vi.fn()) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    (props: { id: string | undefined }) =>
      useDialogRouteRecord({
        id: props.id,
        queryKey: (key) => ['lead', key],
        fetchRecord,
        recordLabel: 'Lead',
        onMissing,
      }),
    { wrapper, initialProps: { id } },
  );
  return { ...hook, onMissing };
}

beforeEach(() => notifyMock.info.mockReset());

describe('useDialogRouteRecord', () => {
  it('stays closed while the dialog route is not matched', () => {
    const { result } = renderRecord(undefined);
    expect(result.current).toEqual({
      record: undefined,
      isOpen: false,
      isPending: false,
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
});
