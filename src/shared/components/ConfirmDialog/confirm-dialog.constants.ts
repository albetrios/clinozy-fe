import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The confirm's chrome lives in `common`: any surface can raise one. */
export const CONFIRM_NS = I18N_NAMESPACES.common;

/** Key paths of the plain confirm's copy; the title stays the caller's ("Delete this lead?"). */
export const CONFIRM_KEYS = {
  accept: 'confirm.accept',
  cancel: 'confirm.cancel',
  fallbackDescription: 'confirm.fallbackDescription',
} as const;

/** The confirm's frame: the end panel from `md`, the bottom sheet below. */
export type ConfirmLayout = 'panel' | 'sheet';

/**
 * The footer buttons per frame: the panel's 36px buttons, the sheet's 44px
 * buttons sharing the row (`_patterns.md` › Right drawer, footer).
 */
export const CONFIRM_BUTTON_CLASS: Readonly<Record<ConfirmLayout, string>> = {
  panel: 'h-9 px-3.5',
  sheet: 'h-11 flex-1 px-3',
};

/** Test ids of the confirm — the plain and the reason confirm share the first four. */
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
