import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';
import type { Weekday } from '@/shared/api/app/app-schema.ts';
import { addCivilDays, civilWeekday, clockMinutes } from '@/shared/api/app/app-time.ts';
import { WEEK } from '@/shared/api/app/app-week.ts';

/**
 * A branch's clinic hours — when it opens and closes (`HH:mm`, clinic-local) and the days it
 * works (`branches.opens_at`, `closes_at`, `working_days`).
 */
export interface BranchHours {
  opensAt: string;
  closesAt: string;
  workingDays: readonly Weekday[];
}

/**
 * The hours a new branch starts with (F18): Monday to Saturday, 10:00–20:00 — clinozy-be's
 * defaults, and the hours read wherever no branch's are known yet.
 */
export const DEFAULT_BRANCH_HOURS = {
  workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  opensAt: '10:00',
  closesAt: '20:00',
} as const satisfies BranchHours;

/** A branch's hours alone, from any record that carries them. */
export function branchHoursOf(branch: BranchHours): BranchHours {
  return {
    opensAt: branch.opensAt,
    closesAt: branch.closesAt,
    workingDays: [...branch.workingDays],
  };
}

/** Whether the branch works on a calendar date (`YYYY-MM-DD`). */
export function isBranchWorkingDay(hours: BranchHours, date: string): boolean {
  return hours.workingDays.includes(civilWeekday(date));
}

/**
 * The first calendar date on or after `from` the branch works — `from` itself when it does. A
 * branch with no working days answers `from` (the server never saves one so).
 */
export function nextBranchWorkingDay(hours: BranchHours, from: string): string {
  for (let offset = 0; offset < WEEK.length; offset += 1) {
    const date = addCivilDays(from, offset);
    if (isBranchWorkingDay(hours, date)) return date;
  }
  return from;
}

// ── This device's branch ──

/**
 * Where this device keeps its branch's hours: written in the signed-in shell, read by the sign-in
 * screen, which has no session to fetch a branch with. Hours only — no name, no id.
 */
export const REMEMBERED_BRANCH_HOURS_KEY = `${PRODUCT_NAMESPACE}:branch-hours`;

const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/u;
const WEEKDAYS: ReadonlySet<string> = new Set(WEEK);

/** Stored hours read back, or null for anything that is not a branch's working day. */
function readBranchHours(raw: unknown): BranchHours | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { opensAt, closesAt, workingDays } = raw as Record<string, unknown>;
  if (typeof opensAt !== 'string' || !CLOCK_TIME.test(opensAt)) return null;
  if (typeof closesAt !== 'string' || !CLOCK_TIME.test(closesAt)) return null;
  if (clockMinutes(closesAt) <= clockMinutes(opensAt)) return null;
  if (!Array.isArray(workingDays)) return null;
  const days = WEEK.filter((day) => workingDays.includes(day));
  if (days.length === 0 || !workingDays.every((day) => WEEKDAYS.has(String(day)))) {
    return null;
  }
  return { opensAt, closesAt, workingDays: days };
}

/**
 * Keep the current branch's hours on this device, for the sign-in screen's tour. A hint that
 * paints a sample day, never a record; storage that refuses (a private window) keeps none.
 */
export function rememberBranchHours(hours: BranchHours): void {
  try {
    localStorage.setItem(
      REMEMBERED_BRANCH_HOURS_KEY,
      JSON.stringify(branchHoursOf(hours)),
    );
  } catch {
    /* storage unavailable — the tour keeps the default hours */
  }
}

/**
 * The hours this device last worked in ({@link rememberBranchHours}), else
 * {@link DEFAULT_BRANCH_HOURS} — a first visit, cleared storage, or a value that no longer reads.
 */
export function rememberedBranchHours(): BranchHours {
  try {
    const raw = localStorage.getItem(REMEMBERED_BRANCH_HOURS_KEY);
    if (!raw) return DEFAULT_BRANCH_HOURS;
    return readBranchHours(JSON.parse(raw)) ?? DEFAULT_BRANCH_HOURS;
  } catch {
    return DEFAULT_BRANCH_HOURS;
  }
}
