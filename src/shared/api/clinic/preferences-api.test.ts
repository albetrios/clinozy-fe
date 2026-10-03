import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_CLINIC_PREFERENCES,
  fetchMyPreferences,
  recentPicksFor,
  resetPreferencesFixture,
  saveMyPreferences,
  withRecentPick,
} from './preferences-api.ts';

beforeEach(() => {
  resetPreferencesFixture();
});

describe('clinic preferences (fixture behind REPLACE_WITH_API)', () => {
  it('starts on the design defaults', async () => {
    const preferences = await fetchMyPreferences();
    expect(preferences.pinnedSections).toEqual([
      'appointments',
      'leads',
      'patients',
      'payments',
    ]);
    expect(preferences.patientFilePins).toEqual([
      'overview',
      'visits',
      'prescriptions',
      'invoices',
    ]);
    expect(preferences.branchFilter).toEqual([]);
    expect(preferences.theme).toBe('light');
  });

  it('merges a change and keeps the rest', async () => {
    await saveMyPreferences({ branchFilter: ['b1'] });
    const preferences = await fetchMyPreferences();
    expect(preferences.branchFilter).toEqual(['b1']);
    expect(preferences.pinnedSections).toEqual(DEFAULT_CLINIC_PREFERENCES.pinnedSections);
  });

  it('never hands out its own record', async () => {
    const preferences = await fetchMyPreferences();
    preferences.pinnedSections.push('users');
    expect((await fetchMyPreferences()).pinnedSections).not.toContain('users');
  });
});

describe('recent picks', () => {
  it('keeps the last three per picker, newest first, by id', () => {
    let picks: string[] = [];
    for (const id of ['p1', 'p2', 'p3', 'p4'])
      picks = withRecentPick(picks, 'appt:patient', id);
    expect(recentPicksFor(picks, 'appt:patient')).toEqual(['p4', 'p3', 'p2']);
  });

  it('moves a repeated pick to the front instead of duplicating it', () => {
    let picks = withRecentPick([], 'appt:patient', 'p1');
    picks = withRecentPick(picks, 'appt:patient', 'p2');
    picks = withRecentPick(picks, 'appt:patient', 'p1');
    expect(recentPicksFor(picks, 'appt:patient')).toEqual(['p1', 'p2']);
  });

  it('keeps pickers apart and caps the list at 60', () => {
    let picks: string[] = [];
    for (let index = 0; index < 30; index += 1) {
      picks = withRecentPick(picks, `picker-${String.fromCharCode(97 + index)}`, 'x');
      picks = withRecentPick(picks, `picker-${String.fromCharCode(97 + index)}`, 'y');
      picks = withRecentPick(picks, `picker-${String.fromCharCode(97 + index)}`, 'z');
    }
    expect(picks).toHaveLength(60);
    expect(recentPicksFor(picks, 'picker-a')).toEqual([]);
    expect(recentPicksFor(picks, `picker-${String.fromCharCode(97 + 29)}`)).toEqual([
      'z',
      'y',
      'x',
    ]);
  });
});
