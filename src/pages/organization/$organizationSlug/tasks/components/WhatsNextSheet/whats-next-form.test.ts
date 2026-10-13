import { describe, expect, it } from 'vitest';

import { appInstant } from '@/shared/api/app/app-time.ts';
import {
  taskRecord,
  TEST_TASK_CONTACT_ID,
  TEST_TASK_LEAD_ID,
} from '@/tests/utils/task-doubles.ts';

import {
  emptyWhatsNextForm,
  WHATS_NEXT_STEP_TONES,
  WHATS_NEXT_STEPS,
  whatsNextFieldsOf,
  whatsNextMissing,
} from './whats-next-form.ts';

const NOW = new Date(appInstant('2026-10-03', '10:00'));
const ME = 'mem_yls33gz5jj66ful8q4ads';
const context = {
  closed: taskRecord(),
  ownerId: ME,
  title: 'Call again · Anaya',
  plannedAfter: 'Planned after: Reply to Anaya · Booked a visit',
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

  it('asks for the step, then when, then who — the member by default', () => {
    expect(whatsNextMissing(emptyWhatsNextForm(), ME)).toEqual(['step', 'when']);
    expect(whatsNextMissing({ ...emptyWhatsNextForm(), step: 'callAgain' }, ME)).toEqual([
      'when',
    ]);
    expect(
      whatsNextMissing(
        { ...emptyWhatsNextForm(), step: 'callAgain', when: 'tomorrow' },
        null,
      ),
    ).toEqual(['ownerId']);
    expect(whatsNextFieldsOf(emptyWhatsNextForm(), context)).toBeNull();
  });

  it('creates a task by hand for the closed task’s person and record, due by the When chip', () => {
    const form = {
      ...emptyWhatsNextForm(),
      step: 'callAgain' as const,
      when: 'tomorrow' as const,
    };
    expect(whatsNextFieldsOf(form, context)).toEqual({
      title: 'Call again · Anaya',
      why: 'Planned after: Reply to Anaya · Booked a visit',
      dueAt: appInstant('2026-10-04', '11:00'),
      assignee: { membershipId: ME },
      priority: 'normal',
      contactId: TEST_TASK_CONTACT_ID,
      link: { kind: 'lead', id: TEST_TASK_LEAD_ID },
    });
    expect(
      whatsNextFieldsOf(
        { ...form, when: 'inThreeHours', note: '  Ask about the peel ' },
        context,
      ),
    ).toMatchObject({
      why: 'Ask about the peel',
      dueAt: new Date(NOW.getTime() + 3 * 3_600_000).toISOString(),
    });
  });

  it('leaves the person and record out for a task about nobody', () => {
    const form = {
      ...emptyWhatsNextForm(),
      step: 'sendOffer' as const,
      when: 'nextWeek' as const,
    };
    expect(
      whatsNextFieldsOf(form, {
        ...context,
        closed: taskRecord({ contact: null, link: null }),
      }),
    ).toMatchObject({ contactId: null, link: null });
    expect(whatsNextFieldsOf(form, { ...context, ownerId: null })).toBeNull();
  });
});
