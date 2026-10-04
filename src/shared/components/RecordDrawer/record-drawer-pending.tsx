import { PanelSkeleton } from '@/shared/components/PanelSkeleton/index.ts';

import type { DrawerContentProfile } from './record-drawer-width.ts';
import { RecordDrawer } from './RecordDrawer.tsx';

/** Props of {@link RecordDrawerPending}. */
export interface RecordDrawerPendingProps {
  open: boolean;
  onClose: () => void;
  /** The drawer's own title — "Edit offering", "Edit supplier". */
  title: string;
  sub: string;
  /** What is loading, for the skeleton's announcement ("Offering", "Supplier"). */
  recordLabel: string;
  /** The loaded drawer's shape, so the width does not jump when it arrives. */
  content?: DrawerContentProfile;
  /** The drawer's own root test id; the skeleton is `<testId>-skeleton`. */
  testId: string;
}

/** Twelve fields, some heavy: the everyday 680px until the record says otherwise. */
const DEFAULT_PROFILE: DrawerContentProfile = { fieldCount: 12, hasHeavyField: true };

/**
 * An edit drawer while its deep-linked record loads (KICKOFF §6.0 States —
 * real latency only, D15): the drawer's shell — its title and sub line — over
 * the shared skeleton, with nothing to save. Opened from a list the record is
 * usually cached already and this never shows.
 */
export function RecordDrawerPending({
  open,
  onClose,
  title,
  sub,
  recordLabel,
  content = DEFAULT_PROFILE,
  testId,
}: RecordDrawerPendingProps) {
  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={title}
      sub={sub}
      content={content}
      testId={testId}
    >
      <PanelSkeleton name={recordLabel} testId={`${testId}-skeleton`} />
    </RecordDrawer>
  );
}
