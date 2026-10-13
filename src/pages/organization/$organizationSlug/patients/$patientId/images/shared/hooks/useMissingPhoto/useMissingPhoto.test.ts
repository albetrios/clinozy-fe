import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/shared/errors/HttpError.ts';

import { useMissingPhoto } from './useMissingPhoto.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { info: vi.fn(), error: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const NOT_FOUND = new HttpError('Patient image not found', 404, '/x', 'GET');

beforeEach(() => {
  notifyMock.info.mockReset();
  notifyMock.error.mockReset();
});

describe('useMissingPhoto', () => {
  it('says "Photo not found" once for a 404, and leaves', () => {
    const onLeave = vi.fn();
    const { rerender } = renderHook(({ error }) => useMissingPhoto(error, onLeave), {
      initialProps: { error: null as unknown },
    });
    expect(onLeave).not.toHaveBeenCalled();
    rerender({ error: NOT_FOUND });
    rerender({ error: NOT_FOUND });
    expect(notifyMock.info).toHaveBeenCalledOnce();
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Photo not found · it may have been deleted',
    );
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('says what went wrong for any other failure, and leaves', () => {
    const onLeave = vi.fn();
    renderHook(() => useMissingPhoto(new TypeError('Failed to fetch'), onLeave));
    expect(notifyMock.info).not.toHaveBeenCalled();
    expect(notifyMock.error).toHaveBeenCalledOnce();
    expect(onLeave).toHaveBeenCalledOnce();
  });
});
