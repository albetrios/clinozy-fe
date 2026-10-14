import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type {
  BranchHoliday,
  BranchPlace,
} from '@/shared/api/app/branch-places-contracts.ts';
import type { DrawerPeekItem } from '@/shared/components/DrawerSteps/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import { useBranchPlaces } from '../../hooks/useBranchPlaces/index.ts';
import { useHolidayDay } from './branch-places-form.ts';

const K = USERS_KEYS.branches.drawer.places;

/** The step's three lists, once read. */
export interface BranchPlacesLists {
  rooms: readonly BranchPlace[];
  machines: readonly BranchPlace[];
  holidays: readonly BranchHoliday[];
}

/** What "Places & days" shows of its reads: the lists, its head line and peek, or why not. */
export interface BranchPlacesView {
  /** Null until every list has answered. */
  lists: BranchPlacesLists | null;
  /** "2 rooms · 1 machine · 3 holidays"; none until the lists are read. */
  summary?: string;
  /** The collapsed step's three items tiles; none until the lists are read. */
  peek?: DrawerPeekItem[];
  /** A list failed and has nothing to show: the step offers one retry. */
  failed: boolean;
  retrying: boolean;
  retry: () => void;
}

/** "2 rooms · 1 machine · 3 holidays" — the lists that hold something, else "No … yet". */
export function placesSummary(lists: BranchPlacesLists, t: TFunction): string {
  const parts = [
    lists.rooms.length > 0 ? t(K.counts.room, { count: lists.rooms.length }) : '',
    lists.machines.length > 0
      ? t(K.counts.machine, { count: lists.machines.length })
      : '',
    lists.holidays.length > 0
      ? t(K.counts.holiday, { count: lists.holidays.length })
      : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : t(K.nothingYet);
}

/** The collapsed step's peek: each list as an items field — its names as chips, an empty list "not filled". */
function placesPeek(
  lists: BranchPlacesLists,
  t: TFunction,
  day: (date: string) => string,
): DrawerPeekItem[] {
  return [
    {
      kind: 'items',
      label: t(K.sections.room),
      names: lists.rooms.map((room) => room.name),
    },
    {
      kind: 'items',
      label: t(K.sections.machine),
      names: lists.machines.map((machine) => machine.name),
    },
    {
      kind: 'items',
      label: t(K.sections.holiday),
      names: lists.holidays.map((holiday) => `${holiday.label} · ${day(holiday.date)}`),
    },
  ];
}

/**
 * "Places & days"'s reads and read-outs (KICKOFF §6.6, D23): the branch's rooms, machines and
 * upcoming holidays, the step's head line and its peek. Idle for a new branch (`branchId` null),
 * which has no fourth step.
 */
export function useBranchPlacesView(branchId: string | null): BranchPlacesView {
  const { t } = useTranslation(USERS_NS);
  const places = useBranchPlaces(branchId);
  const day = useHolidayDay();
  const lists: BranchPlacesLists | null =
    places.rooms && places.machines && places.holidays
      ? { rooms: places.rooms, machines: places.machines, holidays: places.holidays }
      : null;
  return {
    lists,
    ...(lists
      ? { summary: placesSummary(lists, t), peek: placesPeek(lists, t, day) }
      : {}),
    failed: places.failed,
    retrying: places.retrying,
    retry: places.retry,
  };
}
