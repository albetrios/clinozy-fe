import type { PoStage, Tone } from '@/shared/api/clinic/clinic-schema.ts';

/** A purchase order's stage pill and row edge (`medical.md:61`). */
export const PURCHASE_STAGE_TONES: Readonly<Record<PoStage, Tone>> = {
  ordered: 'sky',
  received: 'butter',
  paid: 'sage',
  cancelled: 'stone',
};

/** A sale's status pill and row edge (`medical.md:29`). */
export const SALE_STATUS_TONES: Readonly<Record<'paid' | 'unpaid', Tone>> = {
  paid: 'sage',
  unpaid: 'blush',
};

/** How long a supplier has been owed (`medical.md:77`): 30 days and more blush, 7 butter, else sage. */
export function supplierAgeingTone(days: number): Tone {
  if (days >= 30) return 'blush';
  return days >= 7 ? 'butter' : 'sage';
}

/** An MR's next visit (`medical.md:109`): sky ahead, blush once it is past. */
export function nextVisitTone(nextVisitOn: string, today: string): Tone {
  return nextVisitOn < today ? 'blush' : 'sky';
}
