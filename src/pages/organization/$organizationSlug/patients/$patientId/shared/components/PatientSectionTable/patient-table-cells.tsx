import { AvatarStack } from '@/shared/components/Cells/index.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';

import type { StaffChip } from '../../hooks/useStaffLookup/index.ts';

/** "—" in the muted ink: a cell with nothing to show (H:4754 `{t:'—'}`). */
export function EmptyCell() {
  return <span className="text-muted-foreground">—</span>;
}

/**
 * The tables' people cell (H:3747 `kind:'avatars'` with `s`): the 28px
 * bordered pill, the avatar and the short name ("Dr. Drashti", "Riya S.").
 */
export function StaffCell({ person }: { person: StaffChip | null }) {
  if (!person) return <EmptyCell />;
  return <AvatarStack nameFirst people={[person]} className="min-w-0" />;
}

/**
 * The Updated cell (H:4753): who wrote the record in its pill, then when, by
 * the rooms' one time rule — the Patients room's Updated cell.
 */
export function UpdatedCell({ person, at }: { person: StaffChip | null; at: string }) {
  const clock = useAppClock();
  return (
    <span className="flex min-w-0 items-center gap-2">
      {person ? (
        <AvatarStack nameFirst people={[person]} className="min-w-0 flex-none" />
      ) : null}
      <span className="text-caption text-muted-foreground min-w-0 truncate tabular-nums">
        {clock.moment(at)}
      </span>
    </span>
  );
}

/** The Team cell (H:4753 `kind:'avatars'`): the avatars only, "+N" past three. */
export function TeamCell({ people }: { people: readonly StaffChip[] }) {
  if (people.length === 0) return <EmptyCell />;
  return <AvatarStack people={people} />;
}
