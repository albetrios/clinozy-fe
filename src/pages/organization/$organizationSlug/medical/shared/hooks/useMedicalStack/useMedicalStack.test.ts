import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Manufacturer } from '@/shared/api/app/app-schema.ts';

import { useMedicalStack } from './useMedicalStack.ts';

const ACME = { id: 'm9', name: 'ACME', tone: 'lav', isQuick: false } as Manufacturer;

describe('useMedicalStack', () => {
  it('opens one child with its kind, query and prefill', () => {
    const { result } = renderHook(() => useMedicalStack());
    expect(result.current.child).toBeNull();

    act(() =>
      result.current.open({
        kind: 'supplier',
        query: 'Om Pharma',
        manufacturerIds: ['m1'],
        onCreated: vi.fn(),
      }),
    );

    expect(result.current.child).toMatchObject({
      kind: 'supplier',
      query: 'Om Pharma',
      manufacturerIds: ['m1'],
    });
  });

  it('Back closes the child and selects nothing', () => {
    const onCreated = vi.fn();
    const { result } = renderHook(() => useMedicalStack());

    act(() => result.current.open({ kind: 'mr', query: 'Ravi', onCreated }));
    act(() => result.current.close());

    expect(result.current.child).toBeNull();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('a save closes the child and hands its record to the field that asked', () => {
    const onCreated = vi.fn();
    const { result } = renderHook(() => useMedicalStack());

    act(() => result.current.open({ kind: 'manufacturer', query: 'acme', onCreated }));
    act(() => result.current.complete(ACME));

    expect(result.current.child).toBeNull();
    expect(onCreated).toHaveBeenCalledWith(ACME);
  });
});
