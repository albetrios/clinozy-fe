import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The confirm's chrome lives in `common`: any surface can raise one. */
export const CONFIRM_NS = I18N_NAMESPACES.common;

/** Key paths of the plain confirm's copy; the title stays the caller's ("Delete this lead?"). */
export const CONFIRM_KEYS = {
  accept: 'confirm.accept',
  cancel: 'confirm.cancel',
  fallbackDescription: 'confirm.fallbackDescription',
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
