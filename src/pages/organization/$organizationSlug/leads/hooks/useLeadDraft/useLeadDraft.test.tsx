import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type * as NotifyModule from '@/shared/notify/index.ts';

import { leadRecord } from '../../__tests__/integration/leads-test-data.ts';
import { leadDraftPatch, useLeadDraft } from './useLeadDraft.ts';

vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof NotifyModule>()),
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('leadDraftPatch', () => {
  it('names only what changed — nothing for an untouched draft', () => {
    const lead = leadRecord();
    expect(
      leadDraftPatch(lead, {
        source: lead.source,
        interests: lead.interests,
        customInterests: lead.customInterests,
        status: lead.status,
      }),
    ).toEqual({});
    expect(
      leadDraftPatch(lead, {
        source: 'instagram',
        interests: [...lead.interests, 'peel'],
        customInterests: ['Acne scars'],
        status: 'follow_up',
      }),
    ).toEqual({
      source: 'instagram',
      interests: [...lead.interests, 'peel'],
      customInterests: ['Acne scars'],
      status: 'follow_up',
    });
  });
});

describe('useLeadDraft', () => {
  it('is dirty once a field moves, and Discard starts again from the record', () => {
    const lead = leadRecord();
    const { result } = renderHook(() => useLeadDraft(lead, null), { wrapper });
    expect(result.current.dirty).toBe(false);
    act(() => result.current.update({ status: 'contacted' }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.discard());
    expect(result.current.dirty).toBe(false);
    expect(result.current.draft.status).toBe(lead.status);
  });

  it('starts from the new record when another lead opens', () => {
    const first = leadRecord();
    const { result, rerender } = renderHook(({ lead }) => useLeadDraft(lead, null), {
      wrapper,
      initialProps: { lead: first },
    });
    act(() => result.current.update({ status: 'lost' }));
    rerender({ lead: leadRecord({ id: crypto.randomUUID(), status: 'contacted' }) });
    expect(result.current.dirty).toBe(false);
    expect(result.current.draft.status).toBe('contacted');
  });
});
