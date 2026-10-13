import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type StepMemory, useRememberedStep } from './useRememberedStep.ts';

type Step = 'main' | 'time' | 'details';

function render(memory: StepMemory<Step> | null, key: string, steps: readonly Step[]) {
  const onRemember = vi.fn();
  const view = renderHook(() => useRememberedStep({ memory, onRemember, key, steps }));
  return { ...view, onRemember };
}

describe('useRememberedStep (offerings.md:242)', () => {
  it('opens on step 1 for a record it has not seen', () => {
    const { result } = render({ key: 'other', step: 'time' }, 'O1', ['main', 'time']);
    expect(result.current[0]).toBe('main');
  });

  it('returns to the step the same record had open last', () => {
    const { result } = render({ key: 'O1', step: 'time' }, 'O1', ['main', 'time']);
    expect(result.current[0]).toBe('time');
  });

  it('opens on step 1 when this opening no longer has the remembered step', () => {
    const { result } = render({ key: 'O1', step: 'details' }, 'O1', ['main', 'time']);
    expect(result.current[0]).toBe('main');
  });

  it('remembers each step opened, never "every card collapsed"', () => {
    const { result, onRemember } = render(null, 'new', ['main', 'time', 'details']);
    act(() => result.current[1]('details'));
    expect(result.current[0]).toBe('details');
    expect(onRemember).toHaveBeenLastCalledWith({ key: 'new', step: 'details' });
    act(() => result.current[1](''));
    expect(result.current[0]).toBe('');
    expect(onRemember).toHaveBeenCalledTimes(1);
  });
});
