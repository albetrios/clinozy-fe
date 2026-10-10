import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { DirectoryMember } from '@/shared/api/clinic/directory-api.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { ROLE_TONES } from '@/shared/clinic/clinic-tones.ts';
import { shortPersonName } from '@/shared/components/Cells/index.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useLead } from '@/shared/hooks/useLeads/index.ts';
import { Users } from '@/shared/icons/index.ts';

import {
  TASK_QUEUE_ROLES,
  taskAssigneeKeyOf,
  taskAssigneeOfKey,
  useTaskAssignees,
} from '../../hooks/useTaskAssignees/index.ts';
import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';
import { defaultAssigneeKey } from './new-task-form.ts';
import type { NewTaskPerson } from './new-task-person.ts';

/** "Assign to" as New task offers it. */
export interface NewTaskOwner {
  /** The team who can work tasks (the member first), then the role queues. */
  options: PickerOption<DirectoryMember | null>[];
  /** The default: the person's lead's owner when they can work tasks, else the member. */
  defaultKey: string | null;
  /** An assignee's name as the step and the toast read it: "Riya S.", "Front desk". */
  nameOf: (key: string | null) => string;
}

/**
 * New task's "Assign to" (H:6056, D81 T8), grouped as the task drawer's Assigned list: "Team" —
 * the members who hold `task:read` (`useTaskAssignees`) — then "Role queues" (`owner_role`, the
 * roles in `TASK_QUEUE_ROLES`). The default is the person's open lead's owner — one
 * `GET /app/leads/:id`, for a member with `lead:read`, unless `?lead=` already read it — when
 * that owner can work tasks, else the member.
 */
export function useNewTaskOwner(person: NewTaskPerson | null): NewTaskOwner {
  const { t } = useTranslation(TASKS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const access = useClinicAccess();
  const assignees = useTaskAssignees();
  const canReadLeads = access.isResolved && access.canCode('lead:read');
  // `?lead=` read the lead with the person; a picked person's open lead is read here.
  const unreadLeadId =
    person?.leadOwnerId === undefined ? (person?.openLeadId ?? undefined) : undefined;
  const lead = useLead(canReadLeads ? unreadLeadId : undefined);

  const options = useMemo(() => {
    const team = t(TASKS_KEYS.drawer.assignGroups.team);
    const queues = TASK_QUEUE_ROLES.map((role): PickerOption<DirectoryMember | null> => ({
      key: taskAssigneeKeyOf({ role }),
      label: tClinic(CLINIC_KEYS.roles[role]),
      group: t(TASKS_KEYS.drawer.assignGroups.queues),
      tone: ROLE_TONES[role],
      leading: { kind: 'icon', icon: Users },
      data: null,
    }));
    return [
      ...assignees.options.map((option) => ({ ...option, group: team })),
      ...queues,
    ];
  }, [assignees.options, t, tClinic]);

  const workerIds = useMemo(
    () => new Set(assignees.options.map((option) => option.key)),
    [assignees.options],
  );
  // A lead read for someone else's person (a pick changed meanwhile) names no owner.
  const readOwnerId =
    lead.data && lead.data.id === unreadLeadId ? lead.data.ownerId : null;
  const leadOwnerId = person?.leadOwnerId ?? readOwnerId;

  const nameOf = useCallback(
    (key: string | null) => {
      if (key === null) return '';
      const assignee = taskAssigneeOfKey(key);
      if ('role' in assignee) return tClinic(CLINIC_KEYS.roles[assignee.role]);
      const member = assignees.byId.get(assignee.membershipId);
      return member ? shortPersonName(member.name) : '';
    },
    [assignees.byId, tClinic],
  );

  return {
    options,
    defaultKey: defaultAssigneeKey({
      leadOwnerId,
      myMembershipId: assignees.myMembershipId,
      workerIds,
    }),
    nameOf,
  };
}
