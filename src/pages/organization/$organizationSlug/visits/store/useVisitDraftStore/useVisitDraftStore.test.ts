import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  EMPTY_VISIT_DRAFT,
  useVisitDraft,
  useVisitDraftStore,
} from './useVisitDraftStore.ts';

beforeEach(() => useVisitDraftStore.setState({ drafts: {} }));

describe('useVisitDraftStore (memory only, keyed by visit)', () => {
  it('starts every visit empty and keeps each visit’s draft apart', () => {
    const first = renderHook(() => useVisitDraft('v1'));
    const second = renderHook(() => useVisitDraft('v2'));
    expect(first.result.current.draft).toEqual(EMPTY_VISIT_DRAFT);
    act(() => first.result.current.update({ complaint: 'Dark patches' }));
    act(() =>
      first.result.current.update((draft) => ({ plan: `${draft.complaint} · review` })),
    );
    expect(first.result.current.draft).toMatchObject({
      complaint: 'Dark patches',
      plan: 'Dark patches · review',
    });
    expect(second.result.current.draft.complaint).toBe('');
  });

  it('forgets one visit’s draft', () => {
    const { update, clear } = useVisitDraftStore.getState();
    update('v1', { findings: 'Lighter' });
    update('v2', { findings: 'Same' });
    clear('v1');
    expect(useVisitDraftStore.getState().drafts).toEqual({
      v2: { ...EMPTY_VISIT_DRAFT, findings: 'Same' },
    });
  });
});
