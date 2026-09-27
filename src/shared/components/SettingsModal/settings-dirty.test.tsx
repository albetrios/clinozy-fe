import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  SettingsDirtyProvider,
  useRegisterSettingsDirty,
  useSettingsDirty,
} from './settings-dirty.tsx';

describe('settings-dirty', () => {
  it('tracks dirty flags from registered panels', () => {
    const { result, rerender } = renderHook(
      ({ dirty }) => {
        useRegisterSettingsDirty('panel-a', dirty);
        return useSettingsDirty()?.isDirty ?? false;
      },
      {
        wrapper: SettingsDirtyProvider,
        initialProps: { dirty: false },
      },
    );

    expect(result.current).toBe(false);
    rerender({ dirty: true });
    expect(result.current).toBe(true);
    rerender({ dirty: false });
    expect(result.current).toBe(false);
  });
});
