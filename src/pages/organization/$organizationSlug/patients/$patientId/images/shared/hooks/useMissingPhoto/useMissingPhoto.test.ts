import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMissingPhoto } from './useMissingPhoto.ts';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { info: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

beforeEach(() => notifyMock.info.mockReset());

describe('useMissingPhoto', () => {
  it('says "Photo not found" once and leaves', () => {
    const onLeave = vi.fn();
    const { rerender } = renderHook(({ missing }) => useMissingPhoto(missing, onLeave), {
      initialProps: { missing: false },
    });
    expect(onLeave).not.toHaveBeenCalled();
    rerender({ missing: true });
    rerender({ missing: true });
    expect(notifyMock.info).toHaveBeenCalledOnce();
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Photo not found · it may have been deleted',
    );
    expect(onLeave).toHaveBeenCalledOnce();
  });
});
