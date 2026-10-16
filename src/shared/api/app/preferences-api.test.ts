import { beforeEach, describe, expect, it, vi } from 'vitest';

// The test setup swaps this module for a double; here it is the real one, over a mocked `api`.
vi.unmock('./preferences-api.ts');
vi.mock('@/core/http/api.ts', () => ({ api: { get: vi.fn(), patch: vi.fn() } }));
import { api } from '@/core/http/api.ts';

import {
  fetchMyPreferences,
  recentPicksFor,
  saveMyPreferences,
  withRecentPick,
} from './preferences-api.ts';

/** The record as the API answers it (the server's defaults, before a first save). */
const record = (overrides: Record<string, unknown> = {}) => ({
  data: {
    id: null,
    pinned_sections: ['appointments', 'leads', 'patients', 'payments'],
    theme: 'light',
    branch_ids: [],
    patient_file_pins: ['clinical_notes', 'appointments', 'prescriptions', 'invoices'],
    recent_picks: [],
    created_at: null,
    updated_at: null,
    ...overrides,
  },
  meta: { request_id: 'req_1' },
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchMyPreferences', () => {
  it('reads the record and names its file pins as the file’s tabs', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(record() as never);

    const preferences = await fetchMyPreferences();

    expect(api.get).toHaveBeenCalledWith('/app/memberships/me/preferences');
    expect(preferences).toEqual({
      pinnedSections: ['appointments', 'leads', 'patients', 'payments'],
      branchFilter: [],
      theme: 'light',
      patientFilePins: ['overview', 'visits', 'prescriptions', 'invoices'],
      recentPicks: [],
    });
  });

  it('maps the Overview tab and drops what has no tab here', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      record({
        pinned_sections: ['today', 'contacts', 'activity', 'stock'],
        patient_file_pins: ['overview', 'activity', 'payments'],
        branch_ids: ['br_aaaaaaaaaaaaaaaaaaaaa'],
      }) as never,
    );

    const preferences = await fetchMyPreferences();

    expect(preferences.pinnedSections).toEqual(['today', 'stock']);
    expect(preferences.patientFilePins).toEqual(['timeline', 'payments']);
    expect(preferences.branchFilter).toEqual(['br_aaaaaaaaaaaaaaaaaaaaa']);
  });

  it('reads Branches as a pin, and drops a section this build does not know yet', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      record({ pinned_sections: ['appointments', 'branches', 'a_later_room'] }) as never,
    );

    const preferences = await fetchMyPreferences();

    expect(preferences.pinnedSections).toEqual(['appointments', 'branches']);
  });

  it('refuses an answer shaped differently', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(record({ theme: 'sepia' }) as never);

    await expect(fetchMyPreferences()).rejects.toThrow();
  });
});

describe('saveMyPreferences', () => {
  it('sends only the fields it changes, in the API’s names', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(
      record({ branch_ids: ['br_aaaaaaaaaaaaaaaaaaaaa'] }) as never,
    );

    const saved = await saveMyPreferences({ branchFilter: ['br_aaaaaaaaaaaaaaaaaaaaa'] });

    expect(api.patch).toHaveBeenCalledWith('/app/memberships/me/preferences', {
      body: { branch_ids: ['br_aaaaaaaaaaaaaaaaaaaaa'] },
    });
    expect(saved.branchFilter).toEqual(['br_aaaaaaaaaaaaaaaaaaaaa']);
  });

  it('names the file pins as the API does and leaves out Team notes', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(record() as never);

    await saveMyPreferences({
      patientFilePins: ['timeline', 'overview', 'visits', 'notes'],
    });

    expect(api.patch).toHaveBeenCalledWith('/app/memberships/me/preferences', {
      body: { patient_file_pins: ['overview', 'clinical_notes', 'appointments'] },
    });
  });

  it('keeps only the recent picks the API accepts — room:field:value', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce(record() as never);

    await saveMyPreferences({
      recentPicks: ['appointments:doctor:mem_a', 'legacy:mem_b'],
      pinnedSections: ['today'],
    });

    expect(api.patch).toHaveBeenCalledWith('/app/memberships/me/preferences', {
      body: { pinned_sections: ['today'], recent_picks: ['appointments:doctor:mem_a'] },
    });
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
