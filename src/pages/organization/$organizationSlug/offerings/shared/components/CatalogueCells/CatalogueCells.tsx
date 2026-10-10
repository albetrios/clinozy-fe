import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { BranchOption } from '@/shared/api/clinic/branches-api.ts';
import { ALL_BRANCHES } from '@/shared/api/clinic/clinic-list-filters.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';

import { CATALOGUE_CELLS_KEYS, CATALOGUE_CELLS_NS } from './catalogue-cells.constants.ts';

/** The value's weight in a text cell: 400 by default, 500 for names, 600 for amounts (H:1559). */
const CELL_WEIGHT = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
} as const;

/**
 * A text cell as both tables draw it (H:1559): the value 13px over an
 * optional 11.5px grey sub-line, each truncated on one line.
 */
export function CellText({
  text,
  sub,
  align = 'start',
  weight = 'normal',
  className,
  subClassName,
}: {
  text: string;
  sub?: string;
  align?: 'start' | 'end';
  weight?: keyof typeof CELL_WEIGHT;
  /** The value's ink (the text colour by default). */
  className?: string;
  /** The sub-line's ink (grey by default). */
  subClassName?: string;
}) {
  return (
    <span
      className={cn(
        'flex min-w-0 flex-col leading-[1.3]',
        align === 'end' && 'items-end text-end',
      )}
    >
      <span
        className={cn(
          // After the size: `text-body` brings a 1.45 line height; the cell's is 1.3 (H:1559).
          'text-body max-w-full truncate leading-[1.3] tabular-nums',
          CELL_WEIGHT[weight],
          className,
        )}
      >
        {text}
      </span>
      {sub ? (
        <span
          className={cn(
            'text-caption max-w-full truncate tabular-nums',
            subClassName ?? 'text-muted-foreground',
          )}
        >
          {sub}
        </span>
      ) : null}
    </span>
  );
}

/** One Branches chip: a branch in its tone, or the grey "All branches". */
interface BranchChip {
  id: string;
  label: string;
  branch: BranchOption | undefined;
}

/** The chips of a Branches cell, by value (`branchValues`): branch ids or `all`. */
function useBranchChips(
  values: readonly string[],
  branches: readonly BranchOption[],
): BranchChip[] {
  const { t } = useTranslation(CATALOGUE_CELLS_NS);
  return values.map((value) => {
    const branch = branches.find((candidate) => candidate.id === value);
    return {
      id: value,
      label:
        value === ALL_BRANCHES
          ? t(CATALOGUE_CELLS_KEYS.allBranches)
          : (branch?.name ?? value),
      branch,
    };
  });
}

/**
 * The Branches cell (`offerings.md:31, 47`): one 24px chip per branch in its
 * tone, or a grey "All branches"; nothing with one open branch.
 */
export function BranchChips({
  values,
  branches,
}: {
  /** The record's chips (`branchValues`): branch ids, or `all`. */
  values: readonly string[];
  /** The open branches, for their names and tones. */
  branches: readonly BranchOption[];
}) {
  const chips = useBranchChips(values, branches);
  if (chips.length === 0) return null;
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {chips.map((chip) => (
        <TonePill key={chip.id} tone={chip.branch?.tone ?? 'neutral'}>
          {chip.label}
        </TonePill>
      ))}
    </span>
  );
}

/**
 * The Updated cell (`offerings.md:31`): when the record was last saved, by the
 * rooms' one time rule ("11:44 am", "Yesterday 11:44 am", "25 Sep"). The design's
 * avatar of who saved it is gone — clinozy-be names no one on a record (G10).
 * Hidden by default (Columns brings it).
 */
export function UpdatedCell({ updatedAt }: { updatedAt: string }) {
  const clock = useClinicClock();
  return (
    <span className="text-caption text-muted-foreground min-w-0 truncate tabular-nums">
      {clock.moment(updatedAt)}
    </span>
  );
}
