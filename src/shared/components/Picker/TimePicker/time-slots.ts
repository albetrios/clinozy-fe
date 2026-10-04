import { clockMinutes, clockOfMinutes } from '@/shared/api/clinic/clinic-time.ts';

/** The first tile the time picker offers (`users.md:114`). */
export const TIME_PICKER_FROM = '06:00';
/** The last tile the time picker offers. */
export const TIME_PICKER_TO = '23:30';
/** Minutes between tiles. */
export const TIME_PICKER_STEP = 30;

/**
 * The first tile after `time` — where a closing time's list starts, so it is
 * always after the opening one (the user drawer's To, the branch drawer's
 * Closes; `S:174`). Never past 23:59.
 */
export function nextTimeSlot(time: string, step: number = TIME_PICKER_STEP): string {
  return clockOfMinutes(Math.min(clockMinutes(time) + step, 24 * 60 - 1));
}

/** Clock times `HH:mm` from `from` to `to` (inclusive), every `step` minutes. */
export function timeSlots(
  from: string = TIME_PICKER_FROM,
  to: string = TIME_PICKER_TO,
  step: number = TIME_PICKER_STEP,
): string[] {
  const slots: string[] = [];
  if (step <= 0) return slots;
  for (let minute = clockMinutes(from); minute <= clockMinutes(to); minute += step) {
    slots.push(clockOfMinutes(minute));
  }
  return slots;
}
