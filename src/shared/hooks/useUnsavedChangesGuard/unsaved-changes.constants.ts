import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The discard prompt is chrome every guarded surface shares, so it lives in `common`. */
export const UNSAVED_CHANGES_NS = I18N_NAMESPACES.common;

/** Key paths for the default copy of the unsaved-changes prompt (Q-P1). */
export const UNSAVED_CHANGES_KEYS = {
  title: 'unsavedChanges.title',
  description: 'unsavedChanges.description',
  discard: 'unsavedChanges.discard',
  keepEditing: 'unsavedChanges.keepEditing',
} as const;
