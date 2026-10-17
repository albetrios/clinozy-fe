import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { usePlanAccess } from './usePlanAccess.ts';

const { useMeContextMock } = vi.hoisted(() => ({ useMeContextMock: vi.fn() }));
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({
  useMeContext: useMeContextMock,
}));

afterEach(() => vi.resetAllMocks());

const ACTIVE = { state: 'active', graceEndsAt: null };

describe('usePlanAccess', () => {
  it('reads the active organization’s plan access from me/context', () => {
    const graceEndsAt = '2026-10-31T00:00:00.000Z';
    useMeContextMock.mockReturnValue({
      data: {
        activeOrganization: {
          planAccessWire: { state: 'grace', grace_ends_at: graceEndsAt },
        },
      },
    });
    expect(renderHook(() => usePlanAccess()).result.current).toEqual({
      state: 'grace',
      graceEndsAt,
    });
  });

  it.each([
    ['while me/context loads', undefined],
    ['outside a clinic', { activeOrganization: null }],
    ['when the organization carries none', { activeOrganization: {} }],
  ])('is active %s', (_when, data) => {
    useMeContextMock.mockReturnValue({ data });
    expect(renderHook(() => usePlanAccess()).result.current).toEqual(ACTIVE);
  });
});
