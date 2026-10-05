import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type { TodayLane } from '@/shared/api/clinic/today-contracts.ts';
import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import { type TaskTarget, taskTargetNavigation } from '@/shared/clinic/task-targets.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useClinicNavigate } from '@/shared/hooks/useClinicNavigate/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useMeContext } from '@/shared/hooks/useMeContext/index.ts';
import { useNow } from '@/shared/hooks/useNow/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { LanePanel } from './components/LanePanel/index.ts';
import { LaneTiles } from './components/LaneTiles/index.ts';
import {
  TodayBooking,
  type TodayBookingRequest,
} from './components/TodayBooking/index.ts';
import { TodayGreeting } from './components/TodayGreeting/index.ts';
import { WorkQueue } from './components/WorkQueue/index.ts';
import { useFloorActions } from './hooks/useFloorActions/index.ts';
import { useTodayFloorView } from './hooks/useTodayFloorView/index.ts';
import { useWorkQueue, type WorkQueueScope } from './hooks/useWorkQueue/index.ts';
import { TODAY_KEYS, TODAY_NS, TODAY_TEST_IDS } from './today.constants.ts';
import { defaultTodayLane, todayFocus } from './today.lanes.ts';
import { validateTodaySearch } from './today.search.ts';

/**
 * Where a work-queue outcome's follow-on goes (KICKOFF §6.2): a booking opens
 * the shared form stacked over Today (step 1 collapsed, as from a task); a
 * record — the lead, the patient file — is a navigation that keeps Today as
 * the room to come back to.
 */
function useFollowOn(
  organizationSlug: string,
  book: (request: TodayBookingRequest) => void,
) {
  const navigate = useClinicNavigate();
  const access = useClinicAccess();
  return (target: TaskTarget) => {
    if (target.kind === 'newAppointment') {
      if (!access.can('appointments', 'create')) return;
      book({
        mode: 'create',
        prefill: {
          whoId: target.whoId,
          collapsed: true,
          ...(target.copyOf ? { copyOf: target.copyOf } : {}),
        },
      });
      return;
    }
    if (target.kind === 'appointment' && target.reschedule) {
      book({ mode: 'reschedule', appointmentId: target.appointmentId });
      return;
    }
    void navigate(taskTargetNavigation(target, organizationSlug, 'today'));
  };
}

/**
 * Today (KICKOFF §6.2; `today.md`): the clinic floor now. The greeting row —
 * the greeting is the title — over the seven lane tiles and the selected
 * lane's cards, with the work queue beside them (under them on a phone). The
 * lane and the queue's scope live in the URL (`today.search.ts`); the floor
 * is the header's branches, polled every 60s. Lanes outside the member's
 * focus dim; the default lane is the first in focus with people. First load
 * wears the in-place skeleton; later visits show the cache at once.
 */
export function TodayPage() {
  const { t } = useTranslation(TODAY_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const search = validateTodaySearch(useSearch({ strict: false }));
  const { patchSearch } = useDataTableUrlState(true);
  const now = useNow();
  const today = clinicToday(now);
  const access = useClinicAccess();
  const me = useMeContext();
  const floor = useTodayFloorView();
  const actions = useFloorActions(organizationSlug);
  const [booking, setBooking] = useState<TodayBookingRequest | null>(null);
  const scope: WorkQueueScope = search.queue ?? 'mine';
  const followOn = useFollowOn(organizationSlug, setBooking);
  const queue = useWorkQueue({ scope, onFollowOn: followOn });

  const focus = useMemo(() => todayFocus(access.roles), [access.roles]);
  const lane: TodayLane = search.lane ?? defaultTodayLane(floor.lanes, focus);
  const loading = floor.loading || queue.loading;

  const newBooking =
    access.isResolved && access.can('leads', 'create')
      ? () => void navigate(clinicCommandNavigation('newLead', { organizationSlug }))
      : undefined;

  return (
    <section
      data-testid={TODAY_TEST_IDS.page}
      aria-busy={loading || undefined}
      className="flex flex-col overflow-x-clip md:min-h-0 md:flex-1"
    >
      {loading ? <output className="sr-only">{t(TODAY_KEYS.loading)}</output> : null}
      <div className="grid grid-cols-1 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_312px]">
        <div
          // The first load: bars over every leaf in place (the rooms' one skeleton, index.css).
          data-refreshing={floor.loading || undefined}
          className="flex min-w-0 flex-col gap-3.5 px-3 pt-3.5 pb-2.5 md:min-h-0 md:overflow-y-auto md:px-5.5 md:pt-4 md:pb-3"
        >
          <TodayGreeting
            firstName={me.data?.user.firstName ?? null}
            now={now}
            counts={floor.pulse}
            onNewBooking={newBooking}
            onWalkIn={() => useUIStore.getState().setCommandPaletteOpen(true)}
          />
          <LaneTiles
            lanes={floor.lanes}
            selected={lane}
            focus={focus}
            today={today}
            onSelect={(next) => patchSearch({ lane: next })}
          />
          <LanePanel
            lane={lane}
            cards={floor.lanes[lane]}
            loading={floor.loading}
            now={now}
            today={today}
            actionOf={actions.actionOf}
            onOpen={actions.open}
          />
        </div>
        <WorkQueue
          entries={queue.entries}
          openCount={queue.openCount}
          loading={queue.loading}
          scope={scope}
          onScopeChange={(next) =>
            patchSearch({ queue: next === 'mine' ? undefined : next })
          }
          now={now}
          onOutcome={queue.record}
        />
      </div>
      <TodayBooking request={booking} onClose={() => setBooking(null)} />
    </section>
  );
}
