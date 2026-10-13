import { describe, expect, it } from 'vitest';

import { appointmentFormWidths } from './appointment-form-widths.ts';

describe('appointmentFormWidths (KICKOFF §6.4 Widths, D33)', () => {
  it('gives New and Reschedule min(760, max(560, vw − 56))', () => {
    expect(appointmentFormWidths(1440, null, false)).toEqual({
      total: 760,
      form: 760,
      chat: 0,
    });
    expect(appointmentFormWidths(1024, null, false).total).toBe(760);
    expect(appointmentFormWidths(820, null, false).total).toBe(760);
    expect(appointmentFormWidths(768, null, false).total).toBe(712);
  });

  it('keeps the prototype’s Edit widths from 1,280 up: 760 + 420', () => {
    expect(appointmentFormWidths(1440, null, true)).toEqual({
      total: 1180,
      form: 760,
      chat: 420,
    });
    expect(appointmentFormWidths(1280, null, true)).toEqual({
      total: 1180,
      form: 760,
      chat: 420,
    });
  });

  it('fits Edit inside vw − 56 where the prototype overflowed (the width fix)', () => {
    expect(appointmentFormWidths(1024, null, true)).toEqual({
      total: 968,
      form: 548,
      chat: 420,
    });
    expect(appointmentFormWidths(820, null, true)).toEqual({
      total: 764,
      form: 400,
      chat: 364,
    });
    expect(appointmentFormWidths(768, null, true)).toEqual({
      total: 712,
      form: 352,
      chat: 360,
    });
  });

  it('never leaves the 56px gutter, so the × always shows', () => {
    for (let width = 768; width <= 1600; width += 4) {
      const { total, form, chat } = appointmentFormWidths(width, null, true);
      expect(total).toBeLessThanOrEqual(width - 56);
      expect(form + chat).toBe(total);
      expect(chat).toBeGreaterThanOrEqual(360);
    }
  });

  it('takes the lead-chat width preference, within its bounds', () => {
    expect(appointmentFormWidths(1440, 500, true)).toEqual({
      total: 1260,
      form: 760,
      chat: 500,
    });
    // The ceiling: min(980, 94vw) − 400 = 580 at 1440.
    expect(appointmentFormWidths(1440, 680, true).chat).toBe(580);
    expect(appointmentFormWidths(1440, 300, true).chat).toBe(360);
  });
});
