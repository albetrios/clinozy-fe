import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** Table-cell copy lives in `common` with the rest of the shared chrome. */
export const CELLS_NS = I18N_NAMESPACES.common;

/** Key paths for the cells' own copy (every value verbatim from the design). */
export const CELLS_KEYS = {
  /** The spoken meaning of the "P" badge. */
  patient: 'cells.patient',
  /** The "P" badge's glyph (KICKOFF: "the P badge is text"). */
  patientMark: 'cells.patientMark',
  /** The lead's "L" badge glyph (calendar blocks, H:5929). */
  leadMark: 'cells.leadMark',
  /** Spoken for an avatar stack's "+N" pill. */
  moreCount: 'cells.moreCount',
} as const;
