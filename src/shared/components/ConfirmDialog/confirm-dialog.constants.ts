import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The confirm's chrome lives in `common`: any surface can raise one. */
export const CONFIRM_NS = I18N_NAMESPACES.common;

/**
 * Key paths of the confirm's copy. The reason variant's kinds, reasons, hints
 * and placeholders are verbatim from the design (`_patterns.md` › Delete
 * confirm); the title stays the caller's ("Delete this lead?").
 */
export const CONFIRM_KEYS = {
  accept: 'confirm.accept',
  cancel: 'confirm.cancel',
  fallbackDescription: 'confirm.fallbackDescription',
  keep: 'confirm.keep',
  reason: 'confirm.reason',
  note: 'confirm.note',
  notePlaceholder: 'confirm.notePlaceholder',
  noteRequired: 'confirm.noteRequired',
  hintPickReason: 'confirm.hintPickReason',
  hintAddNote: 'confirm.hintAddNote',
  kinds: {
    delete: {
      action: 'confirm.kinds.delete.action',
      effect: 'confirm.kinds.delete.effect',
    },
    cancel: {
      action: 'confirm.kinds.cancel.action',
      effect: 'confirm.kinds.cancel.effect',
    },
    void: {
      action: 'confirm.kinds.void.action',
      effect: 'confirm.kinds.void.effect',
    },
  },
  reasons: {
    mistake: 'confirm.reasons.mistake',
    duplicate: 'confirm.reasons.duplicate',
    notNeeded: 'confirm.reasons.notNeeded',
    other: 'confirm.reasons.other',
    orderedByMistake: 'confirm.reasons.orderedByMistake',
    supplierCantDeliver: 'confirm.reasons.supplierCantDeliver',
    priceChanged: 'confirm.reasons.priceChanged',
    billedByMistake: 'confirm.reasons.billedByMistake',
    wrongItems: 'confirm.reasons.wrongItems',
    customerChangedMind: 'confirm.reasons.customerChangedMind',
  },
} as const;

/** Test ids of the confirm — the plain dialog and the reason panel / sheet share the first three. */
export const CONFIRM_TEST_IDS = {
  dialog: 'confirm-dialog',
  cancel: 'confirm-cancel',
  accept: 'confirm-accept',
  close: 'confirm-close',
  record: 'confirm-record',
  note: 'confirm-note',
  noteError: 'confirm-note-error',
  reasonError: 'confirm-reasons-error',
  hint: 'confirm-hint',
} as const;

/** One reason chip's test id: `confirm-reason-<value>`, kebab-cased (`not_needed` → `not-needed`). */
export function confirmReasonTestId(value: string): string {
  return `confirm-reason-${value.replaceAll('_', '-')}`;
}
