import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { photoDouble } from '../../__tests__/integration/photo-api-double.ts';
import { usePhotoSelection } from './usePhotoSelection.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const photos = Array.from({ length: 9 }, (_, index) =>
  photoDouble({ id: `pimg_${String(index).repeat(21)}` }),
);

beforeEach(() => {
  vi.resetAllMocks();
  document.body.innerHTML = '';
});

describe('usePhotoSelection', () => {
  it('picks and drops photos in pick order, turning selection on', () => {
    const { result } = renderHook(() => usePhotoSelection());
    expect(result.current.active).toBe(false);
    act(() => result.current.toggle(photos[1]!));
    act(() => result.current.toggle(photos[0]!));
    expect(result.current.active).toBe(true);
    expect(result.current.picked.map((photo) => photo.id)).toEqual([
      photos[1]!.id,
      photos[0]!.id,
    ]);
    expect(result.current.comparable).toBe(true);
    act(() => result.current.toggle(photos[1]!));
    expect([...result.current.ids]).toEqual([photos[0]!.id]);
    expect(result.current.comparable).toBe(false);
  });

  it('takes eight at most and says so for the ninth', () => {
    const { result } = renderHook(() => usePhotoSelection());
    for (const photo of photos) act(() => result.current.toggle(photo));
    expect(result.current.picked).toHaveLength(8);
    expect(result.current.full).toBe(true);
    expect(result.current.ids.has(photos[8]!.id)).toBe(false);
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You can compare up to 8 photos at a time',
    );
  });

  it('clears the picks, and Esc or stop leaves selection', () => {
    const { result } = renderHook(() => usePhotoSelection());
    act(() => result.current.toggle(photos[0]!));
    act(() => result.current.clear());
    expect(result.current.picked).toEqual([]);
    expect(result.current.active).toBe(true);

    const escapeKey = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    act(() => {
      document.dispatchEvent(escapeKey);
    });
    expect(escapeKey.defaultPrevented).toBe(true);
    expect(result.current.active).toBe(false);

    act(() => result.current.start());
    expect(result.current.active).toBe(true);
    act(() => result.current.stop());
    expect(result.current.active).toBe(false);
  });

  it('leaves Esc to a dialog open over the section', () => {
    const { result } = renderHook(() => usePhotoSelection());
    act(() => result.current.start());
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.active).toBe(true);
  });
});
