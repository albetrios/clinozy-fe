import { useTranslation } from 'react-i18next';

import { RetryError } from '@/shared/components/RetryError/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';

import { BRANCHES_KEYS, BRANCHES_NS } from '../../branches.constants.ts';
import { BranchHolidayRows } from './branch-holiday-rows.tsx';
import { BranchPlaceRows } from './branch-place-rows.tsx';
import type { BranchPlacesAccess, PlaceDraftReport } from './branch-places-form.ts';
import type { BranchPlacesView } from './branch-places-view.ts';

const D = BRANCHES_KEYS.drawer;

/** Props of {@link BranchPlacesFields}. */
export interface BranchPlacesFieldsProps {
  branchId: string;
  view: BranchPlacesView;
  access: BranchPlacesAccess;
  onDraft: PlaceDraftReport;
  /** The drawer's root test id: `<testId>-places`, and the lists `<testId>-rooms` · `-machines` · `-holidays`. */
  testId: string;
}

/**
 * "Places & days"'s body — the branch drawer's fourth step, on an existing branch only (KICKOFF
 * §6.6, D3, D23; BRIEF.md:123–133): Rooms, Machines and Holidays, each row saved on its own and
 * never by the drawer's Save. A skeleton while the lists load; one retry when a read failed.
 */
export function BranchPlacesFields({
  branchId,
  view,
  access,
  onDraft,
  testId,
}: BranchPlacesFieldsProps) {
  const { t } = useTranslation(BRANCHES_NS);
  const { lists } = view;
  if (!lists) {
    return view.failed ? (
      <RetryError
        message={t(D.places.loadFailed)}
        onRetry={view.retry}
        isRetrying={view.retrying}
      />
    ) : (
      <SkeletonRows rows={4} label={t(D.steps.places)} rowClassName="h-11" />
    );
  }
  return (
    <div data-testid={`${testId}-places`} className="@container flex flex-col gap-5">
      <BranchPlaceRows
        kind="room"
        branchId={branchId}
        places={lists.rooms}
        access={access}
        onDraft={onDraft}
        testId={`${testId}-rooms`}
      />
      <BranchPlaceRows
        kind="machine"
        branchId={branchId}
        places={lists.machines}
        access={access}
        onDraft={onDraft}
        testId={`${testId}-machines`}
      />
      <BranchHolidayRows
        branchId={branchId}
        holidays={lists.holidays}
        access={access}
        onDraft={onDraft}
        testId={`${testId}-holidays`}
      />
    </div>
  );
}
