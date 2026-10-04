import { PanelSkeleton } from '@/shared/components/PanelSkeleton/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';

/** Props of {@link CatalogueDrawerPending}. */
export interface CatalogueDrawerPendingProps {
  open: boolean;
  onClose: () => void;
  /** "Edit offering" / "Edit offer". */
  title: string;
  sub: string;
  /** What is loading, for the skeleton's announcement ("Offering"). */
  recordLabel: string;
  /** The drawer's own root test id; the skeleton is `<testId>-skeleton`. */
  testId: string;
}

/**
 * An Offerings edit drawer while a deep-linked record loads (KICKOFF §6.11
 * States — real latency only, D15): the drawer's shell, its title and sub
 * line, over the shared skeleton, with nothing to save. Opened from the list,
 * the record is already in the catalogue and this never shows.
 */
export function CatalogueDrawerPending({
  open,
  onClose,
  title,
  sub,
  recordLabel,
  testId,
}: CatalogueDrawerPendingProps) {
  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={title}
      sub={sub}
      content={{ fieldCount: 12, hasHeavyField: true }}
      testId={testId}
    >
      <PanelSkeleton name={recordLabel} testId={`${testId}-skeleton`} />
    </RecordDrawer>
  );
}
