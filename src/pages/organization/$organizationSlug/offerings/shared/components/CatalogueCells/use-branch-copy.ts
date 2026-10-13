import { useTranslation } from 'react-i18next';

import { ALL_BRANCHES } from '@/shared/api/app/app-list-filters.ts';
import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import type { DataTableFoldValue } from '@/shared/components/DataTable/index.ts';
import type { RoomFilterCopy } from '@/shared/components/RoomToolbar/index.ts';

import { CATALOGUE_CELLS_KEYS, CATALOGUE_CELLS_NS } from './catalogue-cells.constants.ts';

/**
 * The Branches cell's meta-line value: the names, the dot in the first one's
 * tone — and "All branches" with the grey chip's dot (a badge value folds with
 * its dot, KICKOFF §6.11; H:4115), quiet so the phone line drops it.
 */
export function useBranchFold(): (
  values: readonly string[],
  branches: readonly BranchOption[],
) => DataTableFoldValue | null {
  const { t } = useTranslation(CATALOGUE_CELLS_NS);
  return (values, branches) => {
    if (values.length === 0) return null;
    if (values.length === 1 && values[0] === ALL_BRANCHES) {
      return {
        value: t(CATALOGUE_CELLS_KEYS.allBranches),
        dotClassName: TONE_CLASSES.stone.fill,
        quiet: true,
      };
    }
    const named = values.flatMap((value) => {
      const branch = branches.find((candidate) => candidate.id === value);
      return branch ? [branch] : [];
    });
    const [first] = named;
    if (!first) return null;
    return {
      value: named.map((branch) => branch.name).join(', '),
      dotClassName: TONE_CLASSES[first.tone].fill,
    };
  };
}

/**
 * The Branches section of a tab's Filters: "All branches", then each open
 * branch in its tone — the cell's chips as filter chips.
 */
export function useBranchFilterCopy(): (
  label: string,
  branches: readonly BranchOption[],
) => RoomFilterCopy {
  const { t } = useTranslation(CATALOGUE_CELLS_NS);
  return (label, branches) => ({
    label,
    options: {
      [ALL_BRANCHES]: { label: t(CATALOGUE_CELLS_KEYS.allBranches) },
      ...Object.fromEntries(
        branches.map((branch) => [branch.id, { label: branch.name, tone: branch.tone }]),
      ),
    },
  });
}
