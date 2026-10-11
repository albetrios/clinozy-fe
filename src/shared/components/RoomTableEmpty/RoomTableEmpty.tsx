import type { ReactNode } from 'react';

import type { Tone } from '@/shared/api/app/app-schema.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';

/** How many placeholder rows stand in for a room list while it loads. */
const SKELETON_ROWS = 8;

/** Props of {@link RoomTableEmpty}. */
export interface RoomTableEmptyProps {
  /** The list is loading: the flat skeleton over the rows' place. */
  loading: boolean;
  /** Filters or a search apply: the filtered state with "Clear filters". */
  filtered: boolean;
  onClearFilters: () => void;
  /** The room's section tone — the illustration's disc and dot. */
  tone: Tone;
  /** The room's 18px icon in the illustration's tile. */
  icon: ReactNode;
  title: string;
  description: string;
  /** The tab's "New …" button (PRD.md:232). */
  action?: ReactNode;
  /** What is loading, for screen readers ("Medicines"). */
  label: string;
  /** Skeleton rows lead with a round avatar (person lists). */
  avatar?: boolean;
}

/**
 * What a room table shows with no rows (KICKOFF §6.0 States): the in-place
 * skeleton while it loads (the first load; a new search or filter), the
 * filtered state when filters hide everything, else the room's illustrated
 * empty state with the tab's "New …" button. Pass it as `DataTable`'s `empty`.
 */
export function RoomTableEmpty({
  loading,
  filtered,
  onClearFilters,
  tone,
  icon,
  title,
  description,
  action,
  label,
  avatar = false,
}: RoomTableEmptyProps) {
  if (loading) {
    return (
      <SkeletonRows
        rows={SKELETON_ROWS}
        avatar={avatar}
        label={label}
        rowClassName="h-13.25 border-b border-b-muted px-(--table-pad-x)"
      />
    );
  }
  if (filtered) return <EmptyState tone={tone} onClearFilters={onClearFilters} />;
  return (
    <EmptyState
      tone={tone}
      icon={icon}
      title={title}
      description={description}
      action={action}
    />
  );
}
