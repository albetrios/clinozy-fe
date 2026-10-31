import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import {
  LEAD_CHAT_WIDTH,
  useDevicePrefsStore,
} from '@/shared/store/useDevicePrefsStore/index.ts';

import {
  sameSavedViewFilters,
  savedViewFilters,
  savedViewName,
  savedViewsKey,
  useSavedViews,
} from './useSavedViews.ts';

/** Sign a person in on this device. */
function signIn(id: string): void {
  useAuthStore.getState().setUser({ id, email: `${id}@clinic.test`, role: 'user' });
}

beforeEach(() => {
  signIn('usr_ada');
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

  it('names values by their labels and skips the ones without a label', () => {
    const labels: Record<string, string> = { female: 'Female', aesthetic: 'Aesthetic' };
    const labelOf = (key: string, value: string) =>
      key === 'createdFrom' ? null : (labels[value] ?? value);
    expect(
      savedViewName(
        { createdFrom: ['2026-09-01'], gender: ['female'], type: ['aesthetic'] },
        'My view',
        labelOf,
      ),
    ).toBe('Female + Aesthetic');
    expect(savedViewName({ createdFrom: ['2026-09-01'] }, 'My view', labelOf)).toBe(
      'My view',
    );
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
    expect(
      useDevicePrefsStore.getState().savedViews[savedViewsKey('usr_ada', 'patients')],
    ).toEqual([{ id, name: 'VIP', filters: { status: ['vip'] } }]);
    expect(result.current.find({ status: ['vip'] })?.id).toBe(id);
    expect(result.current.find({ status: ['new'] })).toBeUndefined();

    // Another table has its own list.
    expect(renderHook(() => useSavedViews('payments')).result.current.views).toEqual([]);

    act(() => result.current.remove(id));
    expect(result.current.views).toEqual([]);
  });

  // F-9: a clinic PC is shared — the next person to sign in must not find these views.
  it('keeps each person’s views to them on a shared device', () => {
    const ada = renderHook(() => useSavedViews('patients'));
    act(() => {
      ada.result.current.save({ status: ['vip'] }, 'VIP');
    });

    act(() => signIn('usr_bob'));
    expect(renderHook(() => useSavedViews('patients')).result.current.views).toEqual([]);

    act(() => signIn('usr_ada'));
    expect(renderHook(() => useSavedViews('patients')).result.current.views).toHaveLength(
      1,
    );
  });

  it('keeps and saves nothing with nobody signed in', () => {
    act(() => useAuthStore.getState().clearAuth());
    const { result } = renderHook(() => useSavedViews('patients'));

    act(() => {
      result.current.save({ status: ['vip'] }, 'VIP');
    });

    expect(result.current.views).toEqual([]);
    expect(useDevicePrefsStore.getState().savedViews).toEqual({});
  });

  it('keeps a stable empty list across renders', () => {
    const { result, rerender } = renderHook(() => useSavedViews('leads'));
    const first = result.current.views;
    rerender();
    expect(result.current.views).toBe(first);
  });
});
