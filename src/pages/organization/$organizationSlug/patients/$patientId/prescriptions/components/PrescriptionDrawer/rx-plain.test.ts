import { describe, expect, it } from 'vitest';

import { emptyRxLine } from './rx-form.ts';
import { rxNoteBeyondDays, rxPlainLine } from './rx-plain.ts';

describe('rxPlainLine — a line in plain words', () => {
  it('reads a tap dose as the times of day it names', () => {
    const plain = rxPlainLine({
      ...emptyRxLine(),
      dose: '1-0-1',
      when: 'after',
      where: 'scalp',
      qty: 20,
      remarks: '10 days',
    });
    expect(plain).toEqual({
      doses: [
        { time: 'morning', count: 1 },
        { time: 'night', count: 1 },
      ],
      when: 'after',
      where: 'scalp',
      days: 10,
      qty: 20,
      note: '',
    });
  });

  it('leaves out a timing that only repeats the doses', () => {
    expect(rxPlainLine({ ...emptyRxLine(), dose: '0-0-1', when: 'night' }).when).toBe('');
    expect(rxPlainLine({ ...emptyRxLine(), dose: '1-0-0', when: 'morning' }).when).toBe(
      '',
    );
    expect(rxPlainLine({ ...emptyRxLine(), dose: '1-0-1', when: 'night' }).when).toBe(
      'night',
    );
    expect(rxPlainLine({ ...emptyRxLine(), dose: '0-0-1', when: 'after' }).when).toBe(
      'after',
    );
  });

  it('reads two at a time and only-when-needed', () => {
    expect(rxPlainLine({ ...emptyRxLine(), dose: '0-2-0' }).doses).toEqual([
      { time: 'afternoon', count: 2 },
    ]);
    expect(rxPlainLine({ ...emptyRxLine(), dose: 'sos' }).doses).toBe('sos');
    expect(rxPlainLine(emptyRxLine()).doses).toEqual([]);
  });

  it('reads the days in the drawer’s own day words', () => {
    expect(
      rxPlainLine({ ...emptyRxLine(), remarks: '5 Tage' }, ['Tag', 'Tage']).days,
    ).toBe(5);
  });
});

describe('rxNoteBeyondDays — the note without its days', () => {
  it.each([
    ['10 days', ''],
    ['10 days, apply thin layer', 'apply thin layer'],
    ['Apply thin layer for 5d', 'Apply thin layer for'],
    ['Leave on 5 minutes', 'Leave on 5 minutes'],
    ['', ''],
  ])('%s → %s', (remarks, note) => {
    expect(rxNoteBeyondDays(remarks)).toBe(note);
  });

  it('reads the drawer’s own day words', () => {
    expect(rxNoteBeyondDays('7 Tage, abends', ['Tag', 'Tage'])).toBe('abends');
  });
});
