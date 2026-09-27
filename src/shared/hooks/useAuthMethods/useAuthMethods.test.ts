import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { resolveAuthMethods } from '@/core/config/auth-methods.ts';

import { useAuthMethods } from './useAuthMethods.ts';

describe('useAuthMethods', () => {
  it('returns resolved auth-method toggles', () => {
    const { result } = renderHook(() => useAuthMethods());
    expect(result.current).toEqual(resolveAuthMethods());
  });
});
