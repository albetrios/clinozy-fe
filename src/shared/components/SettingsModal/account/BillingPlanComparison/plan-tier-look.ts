import type { Tone } from '@/shared/api/app/app-schema.ts';
import { type AppIcon, Building, Rocket, Sparkles, Users } from '@/shared/icons/index.ts';

/** A plan's mark: its icon and the room tone of the disc it sits on. */
export interface PlanTierLook {
  icon: AppIcon;
  tone: Tone;
}

/**
 * One look per rank among the plans, cheapest first — a starting spark, a team, a rocket, a
 * building. Registry glyphs only (a new one would ship in the first-paint chunk); the tones are
 * the rooms' own. A fifth plan and beyond reuse the last look.
 */
const PLAN_TIER_LOOKS: readonly PlanTierLook[] = [
  { icon: Sparkles, tone: 'stone' },
  { icon: Users, tone: 'sky' },
  { icon: Rocket, tone: 'sage' },
  { icon: Building, tone: 'lav' },
];

/** The look of the plan at `rank` (0 = the cheapest). */
export function planTierLook(rank: number): PlanTierLook {
  const last = PLAN_TIER_LOOKS[PLAN_TIER_LOOKS.length - 1] as PlanTierLook;
  return PLAN_TIER_LOOKS[Math.max(0, rank)] ?? last;
}
