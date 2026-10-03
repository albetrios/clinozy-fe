/** The first tile the time picker offers (`users.md:114`). */
export const TIME_PICKER_FROM = '06:00';
/** The last tile the time picker offers. */
export const TIME_PICKER_TO = '23:30';
/** Minutes between tiles. */
export const TIME_PICKER_STEP = 30;

function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function clockOf(minutes: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Clock times `HH:mm` from `from` to `to` (inclusive), every `step` minutes. */
export function timeSlots(
  from: string = TIME_PICKER_FROM,
  to: string = TIME_PICKER_TO,
  step: number = TIME_PICKER_STEP,
): string[] {
  const slots: string[] = [];
  if (step <= 0) return slots;
  for (let minute = minutesOf(from); minute <= minutesOf(to); minute += step) {
    slots.push(clockOf(minute));
  }
  return slots;
}
