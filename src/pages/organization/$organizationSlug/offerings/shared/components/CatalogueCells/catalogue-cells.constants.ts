import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The shared cells' copy lives in the room's namespace. */
export const CATALOGUE_CELLS_NS = I18N_NAMESPACES.offerings;

/** Copy the Offerings and Offers tables share (`offerings.md:31, 47`). */
export const CATALOGUE_CELLS_KEYS = {
  /** The grey chip of a record sold or usable at every branch. */
  allBranches: 'catalogueCells.allBranches',
} as const;
