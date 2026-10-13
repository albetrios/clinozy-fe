import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type Role, ROLE_VALUES } from '@/shared/api/app/app-schema.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import type { TaskAssignee } from '@/shared/api/app/tasks-contracts.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import { useMyMembershipId } from '@/shared/hooks/useMyMembership/index.ts';
import { useTaskWorkerIds } from '@/shared/hooks/useTasks/index.ts';
import { useTeamDirectory } from '@/shared/hooks/useTeamDirectory/index.ts';

import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';

/**
 * The role queues a task can be put in after the team (`owner_role`, D81 TK6) — the presets that
 * work tasks: Pharmacist and Marketing hold `task:read` and `task:update` since D81 (5) (TASKS-M5 —
 * the medical rep visits and their leads' follow-ups); the API takes Accountant too, but no
 * Accountant holds a task code, so that queue would be read by no one.
 */
export const TASK_QUEUE_ROLES = [
  'front_desk',
  'counsellor',
  'doctor',
  'therapist',
  'pharmacist',
  'marketing',
  'admin',
  'owner',
] as const satisfies readonly Role[];

/** A role queue's picker key — apart from the members' `mem_…` keys. */
const QUEUE_KEY_PREFIX = 'role:';

/** An assignee's picker key: the membership id, or `role:<role>` for a queue. */
export function taskAssigneeKeyOf(assignee: TaskAssignee): string {
  return 'membershipId' in assignee
    ? assignee.membershipId
    : `${QUEUE_KEY_PREFIX}${assignee.role}`;
}

/** The assignee a picker key names: a role's queue (`role:<role>`), else a member. */
export function taskAssigneeOfKey(key: string): TaskAssignee {
  const role = key.startsWith(QUEUE_KEY_PREFIX)
    ? ROLE_VALUES.find((value) => key === `${QUEUE_KEY_PREFIX}${value}`)
    : undefined;
  return role ? { role } : { membershipId: key };
}

/** Who a task can go to, as the pickers offer them. */
export interface TaskAssignees {
  /**
   * The active members who can work tasks — they hold `task:read` (D81 T8; anyone else is a
   * `400` "cannot work tasks") — the signed-in one first as "<name> (you)". Empty until both the
   * team and who can work tasks are read.
   */
  options: PickerOption<DirectoryMember>[];
  /** The signed-in member's membership id — `undefined` while it loads, `null` without one. */
  myMembershipId: string | null | undefined;
  /** Every active member by membership id — the names a task's owner and past owners point at. */
  byId: ReadonlyMap<string, DirectoryMember>;
  /** The team or who can work tasks is still being read. */
  isPending: boolean;
}

/**
 * The team a task is assigned from (KICKOFF §6.10 Dropdowns › Assigned; New task's "Assign to";
 * What's next's "Assigned to"): the organization's active members (`useTeamDirectory`) who can
 * work tasks (`useTaskWorkerIds`), the member first as "<name> (you)", each by name — the API
 * names a member's roles by id only (research-tasks T11).
 */
export function useTaskAssignees(): TaskAssignees {
  const { t } = useTranslation(TASKS_NS);
  const directory = useTeamDirectory();
  const workers = useTaskWorkerIds();
  const myMembershipId = useMyMembershipId();
  const { members, byId } = directory;
  const workerIds = workers.data;

  const options = useMemo(() => {
    if (!workerIds) return [];
    const canWork = new Set(workerIds);
    const eligible = members.filter((member) => canWork.has(member.id));
    const ordered = [
      ...eligible.filter((member) => member.id === myMembershipId),
      ...eligible.filter((member) => member.id !== myMembershipId),
    ];
    return ordered.map((member): PickerOption<DirectoryMember> => ({
      key: member.id,
      label:
        member.id === myMembershipId
          ? t(TASKS_KEYS.assignee.you, { name: member.name })
          : member.name,
      tone: member.tone,
      leading: { kind: 'avatar', initials: member.initials },
      keywords: [member.initials, member.name],
      data: member,
    }));
  }, [members, workerIds, myMembershipId, t]);

  return {
    options,
    myMembershipId,
    byId,
    isPending: directory.isPending || workers.isPending,
  };
}
