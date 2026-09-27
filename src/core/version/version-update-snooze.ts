import {
  VERSION_UPDATE_SNOOZE_MS,
  versionUpdateSnoozeKey,
} from './version-check.constants.ts';

export function isVersionUpdateSnoozed(buildId: string, now = Date.now()): boolean {
  try {
    const raw = sessionStorage.getItem(versionUpdateSnoozeKey(buildId));
    if (!raw) return false;
    const until = Number.parseInt(raw, 10);
    if (!Number.isFinite(until)) return false;
    return now < until;
  } catch {
    return false;
  }
}

export function snoozeVersionUpdate(
  buildId: string,
  durationMs = VERSION_UPDATE_SNOOZE_MS,
  now = Date.now(),
): void {
  try {
    sessionStorage.setItem(versionUpdateSnoozeKey(buildId), String(now + durationMs));
  } catch {
    // Private mode — best effort.
  }
}

export function clearVersionUpdateSnooze(buildId: string): void {
  try {
    sessionStorage.removeItem(versionUpdateSnoozeKey(buildId));
  } catch {
    // ignore
  }
}
