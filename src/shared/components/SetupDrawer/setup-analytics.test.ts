import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureMock } = vi.hoisted(() => ({ captureMock: vi.fn() }));
vi.mock('@/shared/analytics/capture.ts', () => ({ captureAnalyticsEvent: captureMock }));

import { setupEvents } from './setup-analytics.ts';
import { captureHeardAbout, HEARD_ABOUT_VALUES } from './setup-heard-about.ts';

/** The keys a setup event may carry — steps, items, outcomes, a duration, a source. */
const ALLOWED_PROPERTIES = new Set([
  'step',
  'item',
  'outcome',
  'minutes_since_clinic_created',
  'source',
]);

beforeEach(() => {
  captureMock.mockReset();
});

describe('setupEvents', () => {
  it('sends each event under its name', () => {
    setupEvents.started();
    setupEvents.stepCompleted('location');
    setupEvents.live();
    setupEvents.deferred('guide');
    setupEvents.guideItem('invite_team', 'skipped');
    setupEvents.guideHidden();

    expect(captureMock.mock.calls).toEqual([
      ['setup_started'],
      ['setup_step_completed', { step: 'location' }],
      ['setup_live'],
      ['setup_deferred', { step: 'guide' }],
      ['setup_guide_item', { item: 'invite_team', outcome: 'skipped' }],
      ['setup_guide_hidden'],
    ]);
  });

  it('counts the minutes from the clinic’s creation to its first booking, never below 0', () => {
    setupEvents.firstAppointmentBooked(
      '2026-10-13T04:00:00Z',
      new Date('2026-10-13T05:30:20Z'),
    );
    setupEvents.firstAppointmentBooked(
      '2026-10-13T04:00:00Z',
      new Date('2026-10-13T03:00:00Z'),
    );

    expect(captureMock.mock.calls).toEqual([
      ['first_appointment_booked', { minutes_since_clinic_created: 90 }],
      ['first_appointment_booked', { minutes_since_clinic_created: 0 }],
    ]);
  });

  it('carries no patient data — only steps, items, outcomes and a duration', () => {
    setupEvents.started();
    setupEvents.stepCompleted('clinic_type');
    setupEvents.stepCompleted('you');
    setupEvents.deferred('location');
    setupEvents.guideItem('treatments', 'done');
    setupEvents.firstAppointmentBooked('2026-10-13T04:00:00Z');
    captureHeardAbout('friendOrColleague');

    for (const [, properties] of captureMock.mock.calls as [string, object?][]) {
      for (const key of Object.keys(properties ?? {})) {
        expect(ALLOWED_PROPERTIES).toContain(key);
      }
    }
  });
});

describe('captureHeardAbout', () => {
  it('sends the stable value, never a label', () => {
    for (const source of HEARD_ABOUT_VALUES) captureHeardAbout(source);

    expect(captureMock.mock.calls).toEqual(
      HEARD_ABOUT_VALUES.map((source) => ['setup_heard_about', { source }]),
    );
  });
});
