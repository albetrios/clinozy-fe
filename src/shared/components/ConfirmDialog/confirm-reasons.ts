import type { DeleteReason } from '@/shared/api/app/app-schema.ts';

import { REASON_CONFIRM_KEYS } from './reason-confirm.constants.ts';

/**
 * The contract's `delete_reason` machine values (`schema-routes.md:1490`).
 * Declared here, not imported: the generated schema module is a page of zod
 * schemas, and a confirm can open from any chunk (Settings, onboarding) — four
 * literals must not drag it in. `confirm-reasons.test.ts` pins this list to
 * `DELETE_REASON_VALUES`.
 */
export const STORED_DELETE_REASONS = [
  'mistake',
  'duplicate',
  'not_needed',
  'other',
] as const satisfies readonly DeleteReason[];

/**
 * The confirm's built-in kinds (`_patterns.md:67–73`). Appointment cancel and
 * photo delete pass their own reasons instead.
 */
export type ConfirmReasonKind = 'delete' | 'cancel' | 'void';

/** One reason chip a confirm offers. */
export interface ConfirmReasonOption {
  /**
   * A `delete_reason` value, or the caller's own id for a reason the schema
   * lacks — stored as `other` with its label in the note (D22, D32).
   */
  value: string;
  /**
   * i18n key of the chip's label. A key outside `common` carries its namespace
   * (`'leads:remove.reasons.spam'`).
   */
  labelKey: string;
}

/** What a confirmed reason hands `onConfirm`: the stored pair, the chip as shown and the typed note. */
export interface ConfirmReasonChoice {
  /** The stored `delete_reason`: the chip's own value when the schema has it, else `other`. */
  reason: DeleteReason;
  /**
   * The stored note — the typed note, after the chip's label when the schema
   * lacks the reason ("Spam · from a bot"); `null` when there is nothing to store.
   */
  note: string | null;
  /** The chip as the user saw it, for a caller that stores another enum (`cancel_reason`, a void). */
  picked: { value: string; label: string };
  /** The typed note, trimmed — `''` when none. */
  comment: string;
}

/** A kind's action label, effect line and reasons. */
interface ReasonKindCopy {
  actionKey: string;
  effectKey: string;
  options: readonly ConfirmReasonOption[];
}

const OTHER: ConfirmReasonOption = {
  value: 'other',
  labelKey: REASON_CONFIRM_KEYS.reasons.other,
};

/** Each built-in kind's copy, verbatim from the design; reasons in chip order. */
export const REASON_KINDS: Readonly<Record<ConfirmReasonKind, ReasonKindCopy>> = {
  delete: {
    actionKey: REASON_CONFIRM_KEYS.kinds.delete.action,
    effectKey: REASON_CONFIRM_KEYS.kinds.delete.effect,
    options: [
      { value: 'mistake', labelKey: REASON_CONFIRM_KEYS.reasons.mistake },
      { value: 'duplicate', labelKey: REASON_CONFIRM_KEYS.reasons.duplicate },
      { value: 'not_needed', labelKey: REASON_CONFIRM_KEYS.reasons.notNeeded },
      OTHER,
    ],
  },
  // A purchase order's `cancelReason` is the same enum: "Ordered by mistake" is
  // `mistake`, the two the schema lacks travel as `other` + their label.
  cancel: {
    actionKey: REASON_CONFIRM_KEYS.kinds.cancel.action,
    effectKey: REASON_CONFIRM_KEYS.kinds.cancel.effect,
    options: [
      { value: 'mistake', labelKey: REASON_CONFIRM_KEYS.reasons.orderedByMistake },
      {
        value: 'supplier_cant_deliver',
        labelKey: REASON_CONFIRM_KEYS.reasons.supplierCantDeliver,
      },
      { value: 'price_changed', labelKey: REASON_CONFIRM_KEYS.reasons.priceChanged },
      OTHER,
    ],
  },
  void: {
    actionKey: REASON_CONFIRM_KEYS.kinds.void.action,
    effectKey: REASON_CONFIRM_KEYS.kinds.void.effect,
    options: [
      { value: 'mistake', labelKey: REASON_CONFIRM_KEYS.reasons.billedByMistake },
      { value: 'wrong_items', labelKey: REASON_CONFIRM_KEYS.reasons.wrongItems },
      {
        value: 'changed_mind',
        labelKey: REASON_CONFIRM_KEYS.reasons.customerChangedMind,
      },
      OTHER,
    ],
  },
};

/**
 * Chip tones by position — blush · butter · lav, then stone for the rest: the
 * fill and ink, and the ring (hover 1px, picked 1.5px) in that ink. Whole
 * literals so Tailwind can see every class.
 */
const REASON_CHIP_TONES = [
  'bg-tone-blush text-tone-blush-foreground hover:ring-tone-blush-foreground data-[state=checked]:ring-tone-blush-foreground',
  'bg-tone-butter text-tone-butter-foreground hover:ring-tone-butter-foreground data-[state=checked]:ring-tone-butter-foreground',
  'bg-tone-lav text-tone-lav-foreground hover:ring-tone-lav-foreground data-[state=checked]:ring-tone-lav-foreground',
  'bg-tone-stone text-tone-stone-foreground hover:ring-tone-stone-foreground data-[state=checked]:ring-tone-stone-foreground',
] as const;

/** The tone classes of the chip at `index` (stone from the fourth on). */
export function reasonChipTone(index: number): string {
  return REASON_CHIP_TONES[Math.min(index, REASON_CHIP_TONES.length - 1)] ?? '';
}

const STORED = new Set<string>(STORED_DELETE_REASONS);

function isStoredReason(value: string): value is DeleteReason {
  return STORED.has(value);
}

/** "Other" is the free-text reason: the confirm waits for a note before it allows the action. */
export function needsNote(value: string): boolean {
  return value === 'other';
}

/** Build the choice for `onConfirm` from the picked chip (value + shown label) and the typed note. */
export function toReasonChoice(
  picked: { value: string; label: string },
  typed: string,
): ConfirmReasonChoice {
  const comment = typed.trim();
  if (isStoredReason(picked.value)) {
    return { reason: picked.value, note: comment || null, picked, comment };
  }
  const note = [picked.label, comment].filter(Boolean).join(' · ');
  return { reason: 'other', note: note || null, picked, comment };
}
