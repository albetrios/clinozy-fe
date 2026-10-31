import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { leadRecord } from '../../__tests__/integration/leads-test-data.ts';
import { useLeadProgress } from './useLeadProgress.ts';

const save = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('@/shared/hooks/useLeads/index.ts', () => ({ useMoveLead: () => save }));

describe('useLeadProgress (D25)', () => {
  it('asks when to follow up before a move into Contacted or Follow-up', () => {
    const lead = leadRecord();
    const { result } = renderHook(() => useLeadProgress(lead));
    act(() => result.current.press('follow_up'));
    expect(result.current.asking).toBe('follow_up');
    expect(save.mutate).not.toHaveBeenCalled();
    act(() =>
      result.current.move({
        status: 'follow_up',
        followUpAt: '2026-10-04T05:30:00.000Z',
      }),
    );
    expect(result.current.asking).toBeNull();
    expect(save.mutate).toHaveBeenLastCalledWith({
      lead,
      status: 'follow_up',
      followUpAt: '2026-10-04T05:30:00.000Z',
    });
  });

  it('moves at once into any other step', () => {
    save.mutate.mockClear();
    const lead = leadRecord({ status: 'contacted' });
    const { result } = renderHook(() => useLeadProgress(lead));
    act(() => result.current.press('new'));
    expect(result.current.asking).toBeNull();
    expect(save.mutate).toHaveBeenLastCalledWith({
      lead,
      status: 'new',
      followUpAt: undefined,
    });
  });
});
