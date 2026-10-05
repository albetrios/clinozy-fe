import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import {
  addCivilDays,
  clinicInstant,
  clinicToday,
} from '@/shared/api/clinic/clinic-time.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import type { ActivityEntry } from './activity-feed.ts';
import { ActivityTimeline } from './ActivityTimeline.tsx';

/** What the feed hands the timeline — each test sets its records. */
const feed = vi.hoisted(() => ({
  entries: [] as ActivityEntry[],
  loading: false,
}));
vi.mock('./use-activity-feed.ts', () => ({ useActivityFeed: () => feed }));

const today = clinicToday();

/** A record `days` from today, at 10:00. */
function entry(
  id: string,
  kind: ActivityEntry['kind'],
  days: number,
  more: Partial<ActivityEntry> = {},
): ActivityEntry {
  const day = addCivilDays(today, days);
  return {
    id,
    kind,
    day,
    at: clinicInstant(day, '10:00'),
    time: null,
    title: id,
    sub: '',
    badge: null,
    by: null,
    open: vi.fn(),
    ...more,
  };
}

const rows = () => screen.getAllByTestId('overview-activity-row');

beforeEach(() => {
  feed.entries = [];
  feed.loading = false;
});
afterEach(() => resetPatientFile());

describe('ActivityTimeline (KICKOFF §6.6, H:4840–4864)', () => {
  it('lists the records newest first under their days, named by the rooms’ one time rule', async () => {
    feed.entries = [
      entry('Peel', 'visit', 0, {
        time: '11:05 AM',
        badge: { label: 'Completed', tone: 'sage' },
        by: { id: 'D', name: 'Dr. Drashti Moradiya', initials: 'DM', tone: 'sage' },
      }),
      entry('Rx #497', 'rx', -1, { sub: 'Avoid sun 48h' }),
      entry('Follow-up', 'visit', 1),
      entry('Review', 'visit', 3),
      entry('Clinic invoice #787', 'inv', -4),
      entry('Far visit', 'visit', 7),
      entry('Old note', 'note', -400),
    ];
    const { container } = renderInPatientFile(<ActivityTimeline />, {
      section: 'timeline',
    });
    await screen.findByTestId('overview-activity');
    expect(rows().map((row) => row.textContent)).toEqual([
      'Far visit',
      'Review',
      'Follow-up',
      'PeelCompleted11:05 AMDM',
      'Rx #497Avoid sun 48h',
      'Clinic invoice #787',
      'Old note',
    ]);
    // The past week by its weekday (en-US, the test's format locale).
    const weekday = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${addCivilDays(today, -4)}T12:00:00Z`));
    for (const heading of ['Tomorrow', 'Today', 'Yesterday', weekday]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
    // A day ahead or a week back: the date alone — with its year when it is not this one.
    expect(screen.queryByText(/days? ago|^In \d/)).not.toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(addCivilDays(today, -400).slice(0, 4))),
    ).toBeInTheDocument();
    expect(screen.getByTitle('Dr. Drashti')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('collapses a day’s photos into one row, and opens a record', async () => {
    const user = userEvent.setup();
    const first = entry('IMG_5102', 'photo', -2, { sub: 'LHR' });
    feed.entries = [
      first,
      entry('IMG_5100', 'photo', -2, { sub: 'General' }),
      entry('IMG_5101', 'photo', -2, { sub: 'LHR' }),
    ];
    renderInPatientFile(<ActivityTimeline />, { section: 'timeline' });
    const [row] = await screen.findAllByTestId('overview-activity-row');
    expect(rows()).toHaveLength(1);
    expect(within(row!).getByText('3 photos')).toBeInTheDocument();
    expect(within(row!).getByText('LHR, General')).toBeInTheDocument();
    await user.click(row!);
    expect(first.open).toHaveBeenCalled();
  });

  it('filters by kind — a tab of none hides, the chosen one selected', async () => {
    const user = userEvent.setup();
    feed.entries = [
      entry('Peel', 'visit', -1),
      entry('Consultation', 'visit', -2),
      entry('Clinic visited', 'note', -2),
    ];
    renderInPatientFile(<ActivityTimeline />, { section: 'timeline' });
    const all = await screen.findByRole('tab', { name: 'All · 3' });
    expect(all).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: /^Prescriptions/ })).not.toBeInTheDocument();
    const visits = screen.getByRole('tab', { name: 'Visits · 2' });
    await user.click(visits);
    expect(visits).toHaveAttribute('aria-selected', 'true');
    expect(all).toHaveAttribute('aria-selected', 'false');
    expect(rows().map((row) => row.textContent)).toEqual(['Peel', 'Consultation']);
    await user.click(screen.getByRole('tab', { name: 'Notes · 1' }));
    expect(rows().map((row) => row.textContent)).toEqual(['Clinic visited']);
  });

  it('says so when the patient has no records — once they have loaded', async () => {
    feed.loading = true;
    const loading = renderInPatientFile(<ActivityTimeline />, { section: 'timeline' });
    await screen.findByTestId('overview-activity');
    expect(screen.queryByText('No activity yet')).not.toBeInTheDocument();
    loading.unmount();

    feed.loading = false;
    renderInPatientFile(<ActivityTimeline />, { section: 'timeline' });
    expect(await screen.findByText('No activity yet')).toBeInTheDocument();
  });
});
