import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const directory = vi.hoisted(() => ({ lookupPin: vi.fn() }));
vi.mock('@/shared/app/pin-directory/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  lookupPin: directory.lookupPin,
}));

import { usePinPlace } from './usePinPlace.ts';

const SURAT = {
  pin: '395007',
  district: 'Surat',
  state: 'Gujarat',
  areas: ['Vesu', 'Piplod'],
};

beforeEach(() => directory.lookupPin.mockReset());

describe('usePinPlace', () => {
  it('looks a full PIN up and clears the place below six digits', async () => {
    directory.lookupPin.mockResolvedValue(SURAT);
    const { result } = renderHook(() => usePinPlace());
    await act(async () => {
      expect(await result.current.lookUp('395007')).toEqual(SURAT);
    });
    expect(result.current.place).toEqual(SURAT);

    await act(async () => {
      expect(await result.current.lookUp('39500')).toBeNull();
    });
    expect(result.current.place).toBeUndefined();
    expect(directory.lookupPin).toHaveBeenCalledTimes(1);
  });

  it('marks an unknown PIN as null', async () => {
    directory.lookupPin.mockResolvedValue(null);
    const { result } = renderHook(() => usePinPlace());
    await act(async () => {
      await result.current.lookUp('395999');
    });
    expect(result.current.place).toBeNull();
  });

  it('never lets a slower answer for an earlier PIN overwrite a later one', async () => {
    let answerFirst: ((place: typeof SURAT) => void) | undefined;
    directory.lookupPin
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce(null);
    const { result } = renderHook(() => usePinPlace());
    let first: Promise<unknown> = Promise.resolve();
    await act(async () => {
      first = result.current.lookUp('395007');
      await result.current.lookUp('395999');
    });
    await act(async () => {
      answerFirst?.(SURAT);
      expect(await first).toBeNull();
    });
    expect(result.current.place).toBeNull();
  });

  it('fills a single area, and clears it for a PIN of several only when it filled it', () => {
    const { result } = renderHook(() => usePinPlace());
    const manjalpur = {
      pin: '390011',
      district: 'Vadodara',
      state: 'Gujarat',
      areas: ['Manjalpur'],
    };
    expect(result.current.areaFor(manjalpur, '')).toBe('Manjalpur');
    expect(result.current.areaFor(SURAT, 'Manjalpur')).toBe('');
    // Typed by hand: never touched.
    expect(result.current.areaFor(SURAT, 'Piplod Plaza')).toBeUndefined();
  });
});
