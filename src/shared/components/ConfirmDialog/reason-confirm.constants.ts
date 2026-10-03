import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The reason confirm's copy lives in `clinic`: it confirms a clinic record's
 * delete, cancel or void, always inside the org shell, which loads `clinic` —
 * so none of it rides the entry bundle. A caller's own option `labelKey`
 * resolves in this namespace too.
 */
export const REASON_CONFIRM_NS = I18N_NAMESPACES.clinic;

/**
 * Key paths of the reason confirm's kinds, reasons, hints and placeholders —
 * verbatim from the design (`_patterns.md` › Delete confirm).
 */
export const REASON_CONFIRM_KEYS = {
  keep: 'reasonConfirm.keep',
  reason: 'reasonConfirm.reason',
  note: 'reasonConfirm.note',
  notePlaceholder: 'reasonConfirm.notePlaceholder',
  noteRequired: 'reasonConfirm.noteRequired',
  hintPickReason: 'reasonConfirm.hintPickReason',
  hintAddNote: 'reasonConfirm.hintAddNote',
  kinds: {
    delete: {
      action: 'reasonConfirm.kinds.delete.action',
      effect: 'reasonConfirm.kinds.delete.effect',
    },
    cancel: {
      action: 'reasonConfirm.kinds.cancel.action',
      effect: 'reasonConfirm.kinds.cancel.effect',
    },
    void: {
      action: 'reasonConfirm.kinds.void.action',
      effect: 'reasonConfirm.kinds.void.effect',
    },
  },
  reasons: {
    mistake: 'reasonConfirm.reasons.mistake',
    duplicate: 'reasonConfirm.reasons.duplicate',
    notNeeded: 'reasonConfirm.reasons.notNeeded',
    other: 'reasonConfirm.reasons.other',
    orderedByMistake: 'reasonConfirm.reasons.orderedByMistake',
    supplierCantDeliver: 'reasonConfirm.reasons.supplierCantDeliver',
    priceChanged: 'reasonConfirm.reasons.priceChanged',
    billedByMistake: 'reasonConfirm.reasons.billedByMistake',
    wrongItems: 'reasonConfirm.reasons.wrongItems',
    customerChangedMind: 'reasonConfirm.reasons.customerChangedMind',
  },
} as const;
