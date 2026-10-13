import { describe, expect, it } from 'vitest';

import { drawerStepStatus } from './drawer-step-status.ts';

describe('drawerStepStatus', () => {
  it('marks the open step open, even with missing fields', () => {
    expect(drawerStepStatus(1, 1, 1, 0)).toBe('open');
    expect(drawerStepStatus(1, 1, 1, 2)).toBe('open');
  });

  it('marks a closed step with a required field still empty as missing', () => {
    expect(drawerStepStatus(0, 1, 1, 1)).toBe('missing');
    expect(drawerStepStatus(2, 1, 1, 1)).toBe('missing');
  });

  it('marks steps before the reference done and after it later', () => {
    expect(drawerStepStatus(0, 2, 2, 0)).toBe('done');
    expect(drawerStepStatus(3, 2, 2, 0)).toBe('later');
  });

  it('keeps the reference step done once every card is collapsed', () => {
    // Nothing open (-1); the last opened step (index 1) is the reference.
    expect(drawerStepStatus(1, -1, 1, 0)).toBe('done');
    expect(drawerStepStatus(2, -1, 1, 0)).toBe('later');
  });

  it('treats every step as later before any has been opened', () => {
    expect(drawerStepStatus(0, -1, -1, 0)).toBe('later');
  });
});
