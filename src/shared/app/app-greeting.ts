/** The part of the day a greeting names. */
export type GreetingPart = 'morning' | 'afternoon' | 'evening';

/**
 * The design's greeting for an hour on the clinic-local clock (`splash.md:94`):
 * "Good morning" before 12:00, "Good afternoon" 12:00–16:59, "Good evening" from
 * 17:00. The real clock, with no clamp — the prototype's 09:00–19:59 clamp was
 * simulation (D15). One rule for the boot splash and Today (KICKOFF §6.1, §6.2).
 */
export function greetingFor(hour: number): GreetingPart {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
