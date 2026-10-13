import { describe, expect, it } from 'vitest';

import { rememberVisitCard, takeVisitCard } from './today.focus.ts';

describe('the visit flow’s way back to its card (KICKOFF §7.2)', () => {
  it('hands the remembered card out once', () => {
    expect(takeVisitCard()).toBeNull();
    rememberVisitCard('a1');
    rememberVisitCard('a2');
    expect(takeVisitCard()).toBe('a2');
    expect(takeVisitCard()).toBeNull();
  });
});
