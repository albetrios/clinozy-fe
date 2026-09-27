import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { VERSION_UPDATE_SNOOZE_MS } from './version-check.constants.ts';
import {
  clearVersionUpdateSnooze,
  isVersionUpdateSnoozed,
  snoozeVersionUpdate,
} from './version-update-snooze.ts';

describe('version-update-snooze', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('is false when no snooze is stored', () => {
    expect(isVersionUpdateSnoozed('build-A')).toBe(false);
  });

  it('is true until the snooze window expires', () => {
    const now = 1_000_000;
    snoozeVersionUpdate('build-A', VERSION_UPDATE_SNOOZE_MS, now);
    expect(isVersionUpdateSnoozed('build-A', now + 1)).toBe(true);
    expect(isVersionUpdateSnoozed('build-A', now + VERSION_UPDATE_SNOOZE_MS)).toBe(false);
  });

  it('clearVersionUpdateSnooze removes the marker', () => {
    snoozeVersionUpdate('build-A');
    clearVersionUpdateSnooze('build-A');
    expect(isVersionUpdateSnoozed('build-A')).toBe(false);
  });
});
