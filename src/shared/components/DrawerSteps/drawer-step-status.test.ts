import { describe, expect, it } from 'vitest';

import { drawerStepStatus, peekHasValue } from './drawer-step-status.ts';

const step = {
  open: false,
  missingCount: 0,
  filled: false,
  reached: false,
};

describe('drawerStepStatus', () => {
  it('marks the open step open, even with missing fields', () => {
    expect(drawerStepStatus({ ...step, open: true })).toBe('open');
    expect(
      drawerStepStatus({ ...step, open: true, missingCount: 2, reached: true }),
    ).toBe('open');
  });

  it('flags a missing required field only once the step was reached or a save was tried', () => {
    expect(drawerStepStatus({ ...step, missingCount: 1 })).toBe('later');
    expect(drawerStepStatus({ ...step, missingCount: 1, filled: true })).toBe('later');
    expect(drawerStepStatus({ ...step, missingCount: 1, reached: true })).toBe('missing');
    expect(drawerStepStatus({ ...step, missingCount: 1, revealMissing: true })).toBe(
      'missing',
    );
  });

  it('marks a step done when it holds something or was reached, nothing required empty', () => {
    expect(drawerStepStatus({ ...step, filled: true })).toBe('done');
    expect(drawerStepStatus({ ...step, reached: true })).toBe('done');
  });

  it('lets the step say whether it is complete, over what it holds and over a visit', () => {
    expect(
      drawerStepStatus({ ...step, filled: true, reached: true, complete: false }),
    ).toBe('later');
    expect(drawerStepStatus({ ...step, complete: true })).toBe('done');
    // A missing required field still wins once reached.
    expect(
      drawerStepStatus({ ...step, missingCount: 1, reached: true, complete: true }),
    ).toBe('missing');
  });

  it('leaves an empty, untouched step later — a save tried does not make it done', () => {
    expect(drawerStepStatus(step)).toBe('later');
    expect(drawerStepStatus({ ...step, revealMissing: true })).toBe('later');
  });
});

describe('peekHasValue', () => {
  it('finds a value, a pick or an item row', () => {
    expect(peekHasValue([{ kind: 'value', label: 'Name', value: 'Riya' }])).toBe(true);
    expect(
      peekHasValue([{ kind: 'multi', label: 'Team', values: [{ label: 'A' }] }]),
    ).toBe(true);
    expect(peekHasValue([{ kind: 'items', label: 'Items', names: ['Peel'] }])).toBe(true);
  });

  it('finds nothing in empty fields or without a peek', () => {
    expect(
      peekHasValue([
        { kind: 'value', label: 'Name', value: '' },
        { kind: 'multi', label: 'Team', values: [] },
        { kind: 'items', label: 'Items', names: [] },
      ]),
    ).toBe(false);
    expect(peekHasValue(undefined)).toBe(false);
  });
});
