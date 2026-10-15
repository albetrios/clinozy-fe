import { fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  todayShortcut,
  type TodayShortcutHandlers,
  useTodayShortcuts,
} from './useTodayShortcuts.ts';

const key = (key: string, extra: Partial<KeyboardEvent> = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  defaultPrevented: false,
  isComposing: false,
  ...extra,
});

function handlers(): Required<TodayShortcutHandlers> {
  return {
    onFind: vi.fn(),
    onLane: vi.fn(),
    onNewBooking: vi.fn(),
    onWalkIn: vi.fn(),
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('todayShortcut (change-today-command-center, D7)', () => {
  it('maps /, [, ], N and W — either case', () => {
    expect(todayShortcut(key('/'))).toBe('find');
    expect(todayShortcut(key('['))).toBe('previousLane');
    expect(todayShortcut(key(']'))).toBe('nextLane');
    expect(todayShortcut(key('n'))).toBe('newBooking');
    expect(todayShortcut(key('N'))).toBe('newBooking');
    expect(todayShortcut(key('w'))).toBe('walkIn');
    expect(todayShortcut(key('W'))).toBe('walkIn');
  });

  it('leaves the app’s keys and every modified, composed or handled press alone', () => {
    for (const app of ['?', 'g', '1', 'k', 'Escape']) {
      expect(todayShortcut(key(app))).toBeNull();
    }
    expect(todayShortcut(key('/', { metaKey: true }))).toBeNull();
    expect(todayShortcut(key('n', { ctrlKey: true }))).toBeNull();
    expect(todayShortcut(key('w', { altKey: true }))).toBeNull();
    expect(todayShortcut(key('n', { isComposing: true }))).toBeNull();
    expect(todayShortcut(key('n', { defaultPrevented: true }))).toBeNull();
  });
});

describe('useTodayShortcuts', () => {
  it('runs each shortcut once and claims the key', () => {
    const run = handlers();
    renderHook(() => useTodayShortcuts(run));
    const slash = new KeyboardEvent('keydown', {
      key: '/',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(slash);
    expect(run.onFind).toHaveBeenCalledTimes(1);
    expect(slash.defaultPrevented).toBe(true);
    fireEvent.keyDown(document.body, { key: '[' });
    fireEvent.keyDown(document.body, { key: ']' });
    expect(run.onLane.mock.calls).toEqual([[-1], [1]]);
    fireEvent.keyDown(document.body, { key: 'n' });
    fireEvent.keyDown(document.body, { key: 'W' });
    expect(run.onNewBooking).toHaveBeenCalledTimes(1);
    expect(run.onWalkIn).toHaveBeenCalledTimes(1);
  });

  it('does nothing for an action the member can’t take — and leaves the key unclaimed', () => {
    const run = handlers();
    renderHook(() => useTodayShortcuts({ onFind: run.onFind, onLane: run.onLane }));
    const n = new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true });
    document.body.dispatchEvent(n);
    expect(n.defaultPrevented).toBe(false);
  });

  it('never fires while typing in a field, inside an open list, or under a dialog', () => {
    const run = handlers();
    renderHook(() => useTodayShortcuts(run));
    const { getByRole, unmount } = render(
      <div>
        <input aria-label="Name" />
        <div role="listbox" aria-label="Results">
          <div role="option" aria-selected="false" tabIndex={-1}>
            Riya
          </div>
        </div>
      </div>,
    );
    fireEvent.keyDown(getByRole('textbox'), { key: 'n' });
    fireEvent.keyDown(getByRole('option'), { key: '/' });
    expect(run.onNewBooking).not.toHaveBeenCalled();
    expect(run.onFind).not.toHaveBeenCalled();
    unmount();

    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true');
    document.body.append(dialog);
    fireEvent.keyDown(document.body, { key: ']' });
    expect(run.onLane).not.toHaveBeenCalled();
  });

  it('stops listening once Today unmounts', () => {
    const run = handlers();
    const { unmount } = renderHook(() => useTodayShortcuts(run));
    unmount();
    fireEvent.keyDown(document.body, { key: '/' });
    expect(run.onFind).not.toHaveBeenCalled();
  });
});
