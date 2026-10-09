import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { StaffProfile } from '@/shared/api/clinic/users-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { personFullName } from '@/shared/components/Cells/index.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import { useFixtureLeadViewer } from '@/shared/hooks/useFixtureLeads/index.ts';
import { useStaffProfiles } from '@/shared/hooks/useTeam/index.ts';

import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';

/** Who a task can go to, as the pickers offer them. */
export interface TaskAssignees {
  /** Every active member — the signed-in one first, "<name> (you)" — with their roles. */
  options: PickerOption<StaffProfile>[];
  /** The signed-in member (REPLACE_WITH_API: the session's; the fixture viewer meanwhile). */
  viewer: StaffProfile | null;
  /** Every member by id, the ones who left included (a task's past owners). */
  byId: ReadonlyMap<string, StaffProfile>;
}

/**
 * The team a task is assigned from (KICKOFF §6.10 Dropdowns › Assigned; New
 * task's "Assign to"; What's next's "Assigned to"): the staff profiles the
 * person pickers read, minus people who left, the member first as "<name>
 * (you)", each with their role line.
 */
export function useTaskAssignees(): TaskAssignees {
  const { t } = useTranslation([TASKS_NS, CLINIC_NS]);
  const staff = useStaffProfiles();
  const viewer = useFixtureLeadViewer().data ?? null;
  const viewerId = viewer?.id ?? null;
  const profiles = staff.data;

  return useMemo(() => {
    const everyone = profiles ?? [];
    const active = everyone.filter((profile) => profile.active);
    const ordered = [
      ...active.filter((profile) => profile.id === viewerId),
      ...active.filter((profile) => profile.id !== viewerId),
    ];
    return {
      viewer,
      byId: new Map(everyone.map((profile) => [profile.id, profile])),
      options: ordered.map((profile) => ({
        key: profile.id,
        label:
          profile.id === viewerId
            ? t(TASKS_KEYS.assignee.you, { ns: TASKS_NS, name: personFullName(profile) })
            : personFullName(profile),
        sub: profile.roles
          .map((role) => t(CLINIC_KEYS.roles[role], { ns: CLINIC_NS }))
          .join(' · '),
        tone: profile.tone,
        leading: { kind: 'avatar', initials: profile.initials },
        keywords: [profile.initials, personFullName(profile)],
        data: profile,
      })),
    };
  }, [profiles, viewer, viewerId, t]);
}
