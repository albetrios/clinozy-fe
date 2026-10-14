import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DeleteReason } from '@/shared/api/app/app-schema.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import {
  addBranchHoliday,
  addBranchPlace,
  branchPlaceQueryKeys,
  changeBranchPlace,
  fetchBranchHolidays,
  fetchBranchPlaces,
  removeBranchHoliday,
  removeBranchPlace,
  restoreBranchHoliday,
  restoreBranchPlace,
} from '@/shared/api/app/branch-places-api.ts';
import type {
  BranchHoliday,
  BranchPlace,
  BranchPlaceChange,
  BranchPlaceKind,
} from '@/shared/api/app/branch-places-contracts.ts';
import { roomNamesQueryKey } from '@/shared/api/app/directory-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useOrganizationId } from '@/shared/store/useOrganizationStore/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';

const K = USERS_KEYS.branches.drawer.places;

/**
 * A branch's rooms, machines and upcoming holidays (KICKOFF §6.6 Places & days) — three reads
 * every member may make, idle without a branch (a new one has none yet). A failed read is shown
 * in place by the step, so none of them toasts.
 */
export function useBranchPlaces(branchId: string | null) {
  const organizationId = useOrganizationId();
  // The clinic's today when the drawer opened: the holidays from it on.
  const [today] = useState(() => appToday());
  const id = branchId ?? '';
  const enabled = organizationId !== null && branchId !== null;
  const rooms = useAppQuery({
    queryKey: branchPlaceQueryKeys.list(organizationId, id, 'room'),
    queryFn: () => fetchBranchPlaces({ kind: 'room', branchId: id }),
    enabled,
    // Shown in place: the step's retry.
    notifyOnError: false,
  });
  const machines = useAppQuery({
    queryKey: branchPlaceQueryKeys.list(organizationId, id, 'machine'),
    queryFn: () => fetchBranchPlaces({ kind: 'machine', branchId: id }),
    enabled,
    // Shown in place: the step's retry.
    notifyOnError: false,
  });
  const holidays = useAppQuery({
    queryKey: branchPlaceQueryKeys.list(organizationId, id, 'holiday'),
    queryFn: () => fetchBranchHolidays({ branchId: id, from: today }),
    enabled,
    // Shown in place: the step's retry.
    notifyOnError: false,
  });
  const reads = [rooms, machines, holidays];
  return {
    rooms: rooms.data,
    machines: machines.data,
    holidays: holidays.data,
    /** Every list has answered. */
    ready: reads.every((read) => read.data !== undefined),
    /** A list failed and has nothing to show. */
    failed: reads.some((read) => read.isError && read.data === undefined),
    retrying: reads.some((read) => read.isFetching),
    retry: () => {
      for (const read of reads) {
        if (read.isError) read.refetch();
      }
    },
  };
}

/** A room's or machine's change, from its row. */
export interface BranchPlaceChangeVars {
  place: BranchPlace;
  change: BranchPlaceChange;
}

/** A removal and the confirm's reason. */
export interface BranchPlaceRemoveVars<TRecord> {
  record: TRecord;
  reason: DeleteReason;
  note: string | null;
}

/**
 * A branch's room or machine writes, each row on its own: add (`branch:create`), rename or switch
 * on / off (`branch:update` — in place at once, rolled back on a refusal) and remove with Undo
 * (`branch:delete`). Each refreshes that list. Add and change report a failure to their row, which
 * shows it in place; remove and restore toast their own.
 */
export function useBranchPlaceWrites({
  kind,
  branchId,
}: {
  kind: BranchPlaceKind;
  branchId: string;
}) {
  const { t } = useTranslation(USERS_NS);
  const queryClient = useQueryClient();
  const organizationId = useOrganizationId();
  const listKey = branchPlaceQueryKeys.list(organizationId, branchId, kind);
  // A room's name is also read by the appointment form and Today through the directory.
  const invalidateKeys =
    kind === 'room' ? [listKey, roomNamesQueryKey(branchId)] : [listKey];
  const toastId = `branch-places-${kind}`;

  const add = useAppMutation<BranchPlace, { name: string }>({
    mutationFn: ({ name }, action) => addBranchPlace({ kind, branchId, name, ...action }),
    invalidateKeys,
    successMessage: (place) => t(K.added, { name: place.name }),
    notifyOnError: false,
    toastId,
  });

  const change = useAppMutation<BranchPlace, BranchPlaceChangeVars, BranchPlace[]>({
    mutationFn: ({ place, change: patch }, action) =>
      changeBranchPlace({ kind, place, change: patch, ...action }),
    optimistic: {
      queryKey: listKey,
      update: (rows, { place, change: patch }) =>
        rows?.map((row) => (row.id === place.id ? { ...row, ...patch } : row)),
    },
    invalidateKeys,
    successMessage: (saved, { change: patch }) => {
      if ('name' in patch) return t(K.renamed, { name: saved.name });
      return t(saved.active ? K.switchedOn : K.switchedOff, { name: saved.name });
    },
    // The next change carries this one's `updated_at` even before the list is read again.
    onSuccess: (saved) => {
      queryClient.setQueryData<BranchPlace[]>(listKey, (rows) =>
        rows?.map((row) => (row.id === saved.id ? saved : row)),
      );
    },
    notifyOnError: false,
    toastId,
  });

  const remove = useAppMutation<void, BranchPlaceRemoveVars<BranchPlace>>({
    mutationFn: ({ record, reason, note }) =>
      removeBranchPlace({ kind, place: record, reason, note }),
    invalidateKeys,
    toastId,
  });

  const restore = useAppMutation<BranchPlace, BranchPlace>({
    mutationFn: (place, action) => restoreBranchPlace({ kind, place, ...action }),
    invalidateKeys,
    toastId,
  });

  /** Read the list again — after someone else's change refused ours. */
  const reload = () => void queryClient.invalidateQueries({ queryKey: listKey });

  return { add, change, remove, restore, reload };
}

/**
 * A branch's holiday writes, each row on its own: add (`branch:create`; its row shows a refusal)
 * and remove with Undo (`branch:delete`). Each refreshes the holidays.
 */
export function useBranchHolidayWrites({ branchId }: { branchId: string }) {
  const { t } = useTranslation(USERS_NS);
  const organizationId = useOrganizationId();
  const listKey = branchPlaceQueryKeys.list(organizationId, branchId, 'holiday');
  const toastId = 'branch-places-holiday';

  const add = useAppMutation<BranchHoliday, { date: string; label: string }>({
    mutationFn: ({ date, label }, action) =>
      addBranchHoliday({ branchId, date, label, ...action }),
    invalidateKeys: [listKey],
    successMessage: (holiday) => t(K.added, { name: holiday.label }),
    notifyOnError: false,
    toastId,
  });

  const remove = useAppMutation<void, BranchPlaceRemoveVars<BranchHoliday>>({
    mutationFn: ({ record, reason, note }) =>
      removeBranchHoliday({ holiday: record, reason, note }),
    invalidateKeys: [listKey],
    toastId,
  });

  const restore = useAppMutation<BranchHoliday, BranchHoliday>({
    mutationFn: (holiday, action) => restoreBranchHoliday({ holiday, ...action }),
    invalidateKeys: [listKey],
    toastId,
  });

  return { add, remove, restore };
}
