import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import { type TaskRow, visibleTaskOutcomes } from '@/shared/api/app/tasks-contracts.ts';
import type { TodayLane } from '@/shared/api/app/today-contracts.ts';
import { appCommandNavigation } from '@/shared/app/app-command-targets.ts';
import { type TaskTarget, taskTargetNavigation } from '@/shared/app/task-targets.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useAppNavigate } from '@/shared/hooks/useAppNavigate/index.ts';
import { useRolesInForce } from '@/shared/hooks/useAppRoles/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useMeContext } from '@/shared/hooks/useMeContext/index.ts';
import { useMyMembershipId } from '@/shared/hooks/useMyMembership/index.ts';
import { useNow } from '@/shared/hooks/useNow/index.ts';
import { useRequireOpenBranch } from '@/shared/hooks/useRequireOpenBranch/index.ts';
import { useTeamDirectory } from '@/shared/hooks/useTeamDirectory/index.ts';
import { House } from '@/shared/icons/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { FloorFinder } from './components/FloorFinder/index.ts';
import { LanePanel, type TodaySpotlight } from './components/LanePanel/index.ts';
import { LaneTiles } from './components/LaneTiles/index.ts';
import { NeedsYouNow } from './components/NeedsYouNow/index.ts';
import {
  TodayBooking,
  type TodayBookingRequest,
} from './components/TodayBooking/index.ts';
import { TodayGreeting } from './components/TodayGreeting/index.ts';
import { WorkQueue, type WorkQueueTeam } from './components/WorkQueue/index.ts';
import { useCheckoutDues } from './hooks/useCheckoutDues/index.ts';
import { useFloorActions } from './hooks/useFloorActions/index.ts';
import { useTodayFloorView } from './hooks/useTodayFloorView/index.ts';
import { useTodayShortcuts } from './hooks/useTodayShortcuts/index.ts';
import { useWorkQueue, type WorkQueueScope } from './hooks/useWorkQueue/index.ts';
import { todayAttention, todayLaneAlerts } from './today.attention.ts';
import { TODAY_KEYS, TODAY_NS, TODAY_TEST_IDS } from './today.constants.ts';
import {
  defaultTodayLane,
  readableTodayLanes,
  type TodayCard,
  todayFocus,
  type TodayLanes,
} from './today.lanes.ts';
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
  const navigate = useAppNavigate();
  const access = useAppAccess();
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
 * The work queue beside the floor (KICKOFF §6.2; research-tasks §7 flag 3): shown to a member who
 * reads tasks (`task:read`; while the access resolves its bars stand in) — the Accountant holds no
 * task code, so Today is the floor alone for them — its cards' outcomes the
 * ones the member's codes run (`visibleTaskOutcomes`: none without `task:update`, none in a
 * View-as preview), its owners named from the team and "(you)" from the member's membership.
 */
function useTodayWorkQueue(
  scope: WorkQueueScope,
  onFollowOn: (target: TaskTarget) => void,
) {
  const access = useAppAccess();
  const reads = access.isResolved && access.can('tasks', 'view');
  const queue = useWorkQueue({ scope, enabled: reads, onFollowOn });
  const { byId } = useTeamDirectory();
  const myMembershipId = useMyMembershipId();
  const team: WorkQueueTeam = useMemo(
    () => ({ byId, myMembershipId }),
    [byId, myMembershipId],
  );
  const canCode = (code: string) => access.isResolved && access.canCode(code);
  return {
    ...queue,
    shown: reads || !access.isResolved,
    loading: queue.loading || !access.isResolved,
    team,
    outcomesOf: (row: TaskRow) => visibleTaskOutcomes(row, canCode),
  };
}

/**
 * The lanes this member can read (F3, D163) and the one the panel shows: the URL's lane when it is
 * one of them, else the default. Until the member's codes are known, every lane.
 */
function useTodayLanes(
  lanes: TodayLanes,
  focus: ReadonlySet<TodayLane>,
  picked: TodayLane | undefined,
) {
  const access = useAppAccess();
  const leads = !access.isResolved || access.can('leads', 'view');
  const appointments = !access.isResolved || access.can('appointments', 'view');
  const visibleLanes = useMemo(
    () => readableTodayLanes({ leads, appointments }),
    [leads, appointments],
  );
  const lane =
    picked && visibleLanes.includes(picked)
      ? picked
      : defaultTodayLane(lanes, focus, visibleLanes);
  return { visibleLanes, lane };
}

/**
 * The greeting's two buttons, each only for a member who may act on it: New booking opens New lead
 * (`lead:create`); Walk-in opens the command menu to book someone (`appointment:create`, F4). With
 * no open branch a manager lands on the setup drawer's step 2 instead (feat-clinic-setup §6.3).
 */
function useGreetingActions(organizationSlug: string) {
  const navigate = useNavigate();
  const access = useAppAccess();
  const requireOpenBranch = useRequireOpenBranch();
  const newBooking =
    access.isResolved && access.can('leads', 'create')
      ? () =>
          requireOpenBranch(
            () => void navigate(appCommandNavigation('newLead', { organizationSlug })),
          )
      : undefined;
  const walkIn =
    access.isResolved && access.can('appointments', 'create')
      ? () => requireOpenBranch(() => useUIStore.getState().setCommandPaletteOpen(true))
      : undefined;
  return { newBooking, walkIn };
}

/**
 * The floor's lanes as one command surface (change-today-command-center): a picked card —
 * the finder's, a Needs-you-now lane chip — opens its lane and is spotlit; `[` and `]` step
 * through the lanes the member reads (round the end); `/` focuses the finder.
 */
function useFloorNavigation(
  visibleLanes: readonly TodayLane[],
  lane: TodayLane,
  patchSearch: (patch: { lane?: TodayLane }) => void,
) {
  const [spotlight, setSpotlight] = useState<TodaySpotlight | null>(null);
  const finderRef = useRef<HTMLInputElement>(null);
  // The lane the last step asked for: two quick presses step twice, before the URL catches up.
  const steppedTo = useRef(lane);
  useEffect(() => {
    steppedTo.current = lane;
  }, [lane]);
  const jumpTo = (card: TodayCard) => {
    patchSearch({ lane: card.lane });
    setSpotlight((previous) => ({ cardId: card.id, nonce: (previous?.nonce ?? 0) + 1 }));
  };
  const stepLane = (step: -1 | 1) => {
    const count = visibleLanes.length;
    if (count === 0) return;
    const index = visibleLanes.indexOf(steppedTo.current);
    const next = visibleLanes[(index + step + count) % count];
    if (!next) return;
    steppedTo.current = next;
    patchSearch({ lane: next });
  };
  return { spotlight, finderRef, jumpTo, stepLane };
}

/**
 * Today (KICKOFF §6.2; `today.md`; change-today-command-center): the clinic floor now. The
 * greeting row — the greeting is the title, then the floor finder and the buttons — over
 * Needs you now (who needs someone, ranked, each with the lane's action), the journey strip
 * of seven connected lane tiles with their alert badges, and the selected lane's cards, with
 * the work queue beside them (under them on a phone). The lane and the queue's scope live in
 * the URL (`today.search.ts`); the floor is the header's branches, polled every 60s. Lanes
 * outside the member's focus dim, and Needs you now lists the focus lanes only; the default
 * lane is the first in focus with people. Keys: `/`, `[`, `]`, `N`, `W`
 * (`useTodayShortcuts`). First load wears the in-place skeleton; later visits show the cache
 * at once.
 */
export function TodayPage() {
  const { t } = useTranslation(TODAY_NS);
  const { organizationSlug = '' } = useParams({ strict: false });
  const search = validateTodaySearch(useSearch({ strict: false }));
  const { patchSearch } = useDataTableUrlState(true);
  const now = useNow();
  const today = appToday(now);
  const me = useMeContext();
  const floor = useTodayFloorView();
  const actions = useFloorActions(organizationSlug);
  const [booking, setBooking] = useState<TodayBookingRequest | null>(null);
  const scope: WorkQueueScope = search.queue ?? 'mine';
  const followOn = useFollowOn(organizationSlug, setBooking);
  const queue = useTodayWorkQueue(scope, followOn);

  const rolesInForce = useRolesInForce();
  const focus = useMemo(
    () => todayFocus(rolesInForce.flatMap((role) => (role.preset ? [role.preset] : []))),
    [rolesInForce],
  );
  const { visibleLanes, lane } = useTodayLanes(floor.lanes, focus, search.lane);
  const loading = floor.loading || (queue.shown && queue.loading);
  // Today's open bills while anyone is at checkout — the cards' and Needs you now's "₹n to pay".
  const dues = useCheckoutDues({
    enabled: !floor.loading && floor.lanes.checkout.length > 0,
    today,
  });
  const attention = useMemo(
    () => todayAttention({ lanes: floor.lanes, now, dues, focus, visible: visibleLanes }),
    [floor.lanes, now, dues, focus, visibleLanes],
  );
  const alerts = useMemo(() => todayLaneAlerts(floor.lanes, now), [floor.lanes, now]);
  const navigation = useFloorNavigation(visibleLanes, lane, patchSearch);

  const { newBooking, walkIn } = useGreetingActions(organizationSlug);
  useTodayShortcuts({
    onFind: () => navigation.finderRef.current?.focus(),
    onLane: navigation.stepLane,
    onNewBooking: newBooking,
    onWalkIn: walkIn,
  });

  return (
    <section
      data-testid={TODAY_TEST_IDS.page}
      aria-busy={loading || undefined}
      className="flex flex-col overflow-x-clip md:min-h-0 md:flex-1"
    >
      {loading ? <output className="sr-only">{t(TODAY_KEYS.loading)}</output> : null}
      <div
        className={cn(
          'grid grid-cols-1 md:min-h-0 md:flex-1',
          queue.shown && 'md:grid-cols-[minmax(0,1fr)_312px]',
        )}
      >
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
            onWalkIn={walkIn}
            onShortcuts={() => useUIStore.getState().setShortcutsOpen(true)}
            finder={
              visibleLanes.length > 0 ? (
                <FloorFinder
                  lanes={floor.lanes}
                  visible={visibleLanes}
                  today={today}
                  onPick={navigation.jumpTo}
                  onSearchEveryone={() =>
                    useUIStore.getState().setCommandPaletteOpen(true)
                  }
                  inputRef={navigation.finderRef}
                />
              ) : null
            }
          />
          {visibleLanes.length > 0 ? (
            <>
              <NeedsYouNow
                items={attention}
                loading={floor.loading}
                now={now}
                today={today}
                actionOf={actions.actionOf}
                onOpen={actions.open}
                onJump={navigation.jumpTo}
              />
              <LaneTiles
                lanes={floor.lanes}
                selected={lane}
                focus={focus}
                visible={visibleLanes}
                today={today}
                alerts={alerts}
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
                dues={dues}
                spotlight={navigation.spotlight}
              />
            </>
          ) : (
            // The room look in Today's butter (change-empty-states, built beyond R1–R7).
            <EmptyState
              tone="butter"
              icon={<House />}
              title={t(TODAY_KEYS.lanes.none)}
              testId={TODAY_TEST_IDS.noLanes}
            />
          )}
        </div>
        {queue.shown ? (
          <WorkQueue
            entries={queue.entries}
            openCount={queue.openCount}
            loading={queue.loading}
            scope={scope}
            onScopeChange={(next) =>
              patchSearch({ queue: next === 'mine' ? undefined : next })
            }
            now={now}
            team={queue.team}
            outcomesOf={queue.outcomesOf}
            onOutcome={queue.record}
          />
        ) : null}
      </div>
      <TodayBooking request={booking} onClose={() => setBooking(null)} />
    </section>
  );
}
