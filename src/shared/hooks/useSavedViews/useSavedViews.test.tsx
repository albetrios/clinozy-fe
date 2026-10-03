import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  LEAD_CHAT_WIDTH,
  useDevicePrefsStore,
} from '@/shared/store/useDevicePrefsStore/index.ts';

import {
  sameSavedViewFilters,
  savedViewFilters,
  savedViewName,
  useSavedViews,
} from './useSavedViews.ts';

beforeEach(() => {
  useDevicePrefsStore.setState({
    hiddenColumns: {},
    savedViews: {},
    photoSize: 'medium',
    leadChatWidth: LEAD_CHAT_WIDTH.initial,
  });
});

describe('savedViewFilters', () => {
  it('keeps filter values only — never the search text or empty filters', () => {
    expect(savedViewFilters({ q: ['priya'], status: ['vip', 'new'], type: [] })).toEqual({
      status: ['new', 'vip'],
    });
  });
});

describe('sameSavedViewFilters', () => {
  it('ignores key and value order', () => {
    expect(
      sameSavedViewFilters({ a: ['2', '1'], b: ['x'] }, { b: ['x'], a: ['1', '2'] }),
    ).toBe(true);
    expect(sameSavedViewFilters({ a: ['1'] }, { a: ['1', '2'] })).toBe(false);
  });
});

describe('savedViewName (H:4171)', () => {
  it('joins the first two values, else falls back', () => {
    expect(savedViewName({ status: ['VIP', 'New', 'Regular'] }, 'My view')).toBe(
      'VIP + New',
    );
    expect(savedViewName({}, 'My view')).toBe('My view');
  });
});

describe('useSavedViews', () => {
  it('saves, finds and removes views per table on this device', () => {
    const { result } = renderHook(() => useSavedViews('patients'));
    expect(result.current.views).toEqual([]);

    let id = '';
    act(() => {
      id = result.current.save({ status: ['vip'], q: ['priya'] }, 'VIP').id;
    });
    expect(useDevicePrefsStore.getState().savedViews.patients).toEqual([
      { id, name: 'VIP', filters: { status: ['vip'] } },
    ]);
    expect(result.current.find({ status: ['vip'] })?.id).toBe(id);
    expect(result.current.find({ status: ['new'] })).toBeUndefined();

    // Another table has its own list.
    expect(renderHook(() => useSavedViews('payments')).result.current.views).toEqual([]);

    act(() => result.current.remove(id));
    expect(result.current.views).toEqual([]);
  });

  it('keeps a stable empty list across renders', () => {
    const { result, rerender } = renderHook(() => useSavedViews('leads'));
    const first = result.current.views;
    rerender();
    expect(result.current.views).toBe(first);
  });
});
