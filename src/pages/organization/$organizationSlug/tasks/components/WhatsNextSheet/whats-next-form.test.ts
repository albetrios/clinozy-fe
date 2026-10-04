import { describe, expect, it } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';

import {
  emptyWhatsNextForm,
  WHATS_NEXT_STEP_TONES,
  WHATS_NEXT_STEPS,
  whatsNextInputOf,
  whatsNextMissing,
} from './whats-next-form.ts';

const NOW = new Date(clinicInstant('2026-10-03', '10:00'));
const TASK = '11111111-1111-4111-8111-111111111111';
const ME = '22222222-2222-4222-8222-222222222222';
const context = {
  followsTaskId: TASK,
  ownerId: ME,
  title: 'Call again · Priti',
  plannedAfter: 'Planned after: Confirm Priti’s visit · Confirmed on call',
  now: NOW,
};

describe('the What’s next form (H:4054)', () => {
  it('offers five toned steps', () => {
    expect(WHATS_NEXT_STEPS.map((step) => WHATS_NEXT_STEP_TONES[step])).toEqual([
      'sky',
      'sage',
      'lav',
      'peach',
      'butter',
    ]);
  });

  it('asks for the step, then when', () => {
    expect(whatsNextMissing(emptyWhatsNextForm())).toEqual(['step', 'when']);
    expect(whatsNextMissing({ ...emptyWhatsNextForm(), step: 'callAgain' })).toEqual([
      'when',
    ]);
    expect(whatsNextInputOf(emptyWhatsNextForm(), context)).toBeNull();
  });

  it('creates a follow-up after the closed task, due by the When chip', () => {
    const form = {
      ...emptyWhatsNextForm(),
      step: 'callAgain' as const,
      when: 'tomorrow' as const,
    };
    expect(whatsNextInputOf(form, context)).toEqual({
      title: 'Call again · Priti',
      why: 'Planned after: Confirm Priti’s visit · Confirmed on call',
      ownerId: ME,
      dueAt: clinicInstant('2026-10-04', '11:00'),
      rule: 'manual',
      followsTaskId: TASK,
    });
    expect(
      whatsNextInputOf(
        { ...form, when: 'inThreeHours', note: '  Ask about the peel ' },
        context,
      ),
    ).toMatchObject({
      why: 'Ask about the peel',
      dueAt: new Date(NOW.getTime() + 3 * 3_600_000).toISOString(),
    });
  });
});
