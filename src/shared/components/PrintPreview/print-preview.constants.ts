import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The print preview's chrome copy lives in `clinic`: the patient file's
 * prescriptions and the shared invoice routes open it, both inside the org
 * shell.
 */
export const PRINT_PREVIEW_NS = I18N_NAMESPACES.clinic;

/** Key paths for the print preview's chrome (`patient-file.md:301–315`; verbatim). */
export const PRINT_PREVIEW_KEYS = {
  /** "Print preview · Invoice #787". */
  title: 'printPreview.title',
  close: 'printPreview.close',
  /** "Print / Save PDF". */
  print: 'printPreview.print',
} as const;
