import { useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  membershipRoleIdForClinicRoles,
  orgRoleOfName,
} from '@/shared/api/clinic/users-api.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import type { Member, RoleSummary } from '@/shared/api/organization-contracts.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useInviteMember } from '@/shared/hooks/useInvitations/index.ts';
import {
  useUpdateMemberRole,
  useUpdateMemberStatus,
} from '@/shared/hooks/useMembers/index.ts';
import { useSaveStaffProfile } from '@/shared/hooks/useTeam/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { USERS_KEYS, USERS_NS } from '../../users.constants.ts';
import {
  isMobileIncomplete,
  isUserEmail,
  type UserDrawerStepId,
  type UserFormValues,
  userProfileInput,
} from './user-form.ts';

const K = USERS_KEYS.drawer;

/** Which step holds each field — a refused save opens the step of the first one it names. */
const FIELD_STEPS: Readonly<Record<keyof UserFormValues, UserDrawerStepId>> = {
  name: 'profile',
  phone: 'profile',
  email: 'profile',
  tone: 'profile',
  roleKeys: 'profile',
  branchIds: 'profile',
  workingDays: 'hours',
  startsAt: 'hours',
  endsAt: 'hours',
  commissionPct: 'hours',
  active: 'hours',
};

/** The form fields in the drawer's order, for "the first field the server named". */
const FIELD_ORDER = Object.keys(FIELD_STEPS) as (keyof UserFormValues)[];

/** The contract's field names that the form spells differently. */
const SERVER_FIELDS: Readonly<Record<string, keyof UserFormValues>> = {
  role_id: 'roleKeys',
  phone: 'phone',
  firstName: 'name',
  lastName: 'name',
};

/** What a save ended with: a member invited, or one saved — by their full name. */
export type UserSaveOutcome =
  { kind: 'added'; name: string } | { kind: 'saved'; name: string };

/** Options of {@link useUserSave}. */
export interface UseUserSaveOptions {
  form: UseFormReturn<UserFormValues>;
  /** The member an edit saves; null for a new user. */
  member: TeamMember | null;
  /** clinozy-be's roles, for the one role the membership holds. */
  platformRoles: readonly RoleSummary[];
  /** The only open branch: a user is saved on it (`users.md:95`); null with several. */
  singleBranchId: string | null;
  /** Open a step — the one holding the field a check or the server named. */
  onStep: (stepId: UserDrawerStepId) => void;
  /** The save went through; `another` when it was "Create & add another". */
  onDone: (outcome: UserSaveOutcome, another: boolean) => void;
}

/**
 * The user drawer's checks before anything is sent: a role — and, to invite,
 * a clinozy-be role to give them — an email, a ten-digit mobile.
 */
function useUserChecks(inviteRoleMissing: (values: UserFormValues) => boolean) {
  const { t } = useTranslation(USERS_NS);
  return (values: UserFormValues) => {
    if (values.roleKeys.length === 0) {
      return { fields: ['roleKeys' as const], message: t(K.noRole) };
    }
    if (inviteRoleMissing(values)) {
      return { fields: ['roleKeys' as const], message: t(K.noPlatformRole) };
    }
    if (!isUserEmail(values.email)) {
      return { fields: ['email' as const], message: t(K.emailInvalid) };
    }
    if (isMobileIncomplete(values.phone)) {
      return { fields: ['phone' as const], message: t(K.mobileInvalid) };
    }
    return null;
  };
}

/**
 * The user drawer's writes on the shared drawer save (KICKOFF §6.12 Save,
 * §6.0 States). New: the invitation (`useInviteMember` — the membership takes
 * Admin when Admin is picked, else the main role's backend role, else the
 * least-privileged one; D47), then the staff profile. Edit: the membership's
 * role and status when they changed, then the profile. One toast for the
 * whole save — "<name> added" / "<name> saved" (D28). Checks first: a role,
 * an email that reads as one, a mobile of ten digits. An email another
 * member has (409) outlines Email; a dropped connection keeps the draft with
 * "Retry save". A retry after the invitation went out saves only the profile.
 */
export function useUserSave({
  form,
  member,
  platformRoles,
  singleBranchId,
  onStep,
  onDone,
}: UseUserSaveOptions) {
  const writes = { suppressSuccessToast: true, notifyOnError: false } as const;
  const invite = useInviteMember(writes);
  const updateRole = useUpdateMemberRole(writes);
  const updateStatus = useUpdateMemberStatus(writes);
  const saveProfile = useSaveStaffProfile({ notifyOnError: false });
  /** The membership an earlier attempt already created: a retry must not invite twice. */
  const invited = useRef<Member | null>(null);
  // A new user is invited with a clinozy-be role (D47) — unless a retry finds the invitation sent.
  const check = useUserChecks(
    (values) =>
      member === null &&
      invited.current === null &&
      membershipRoleIdForClinicRoles(values.roleKeys, platformRoles) === null,
  );

  /** The membership's role and status writes an edit needs. */
  const saveMembership = async (current: TeamMember, values: UserFormValues) => {
    if (!current.isOwner) {
      const roleId = membershipRoleIdForClinicRoles(values.roleKeys, platformRoles);
      const role = platformRoles.find((candidate) => candidate.id === roleId);
      if (role && roleId !== current.platformRoleId) {
        await updateRole.mutateAsync({
          membershipId: current.membershipId,
          role: orgRoleOfName(role.name),
          roleId: role.id,
        });
      }
    }
    const joined = current.status !== 'invited';
    const wanted = values.active ? 'active' : 'suspended';
    if (joined && !current.isOwner && !current.isSelf && wanted !== current.status) {
      await updateStatus.mutateAsync({
        membershipId: current.membershipId,
        status: wanted,
      });
    }
  };

  const write = async (): Promise<UserSaveOutcome> => {
    const values = form.getValues();
    const name = values.name.trim();
    if (member) {
      await saveMembership(member, values);
      await saveProfile.mutateAsync(
        userProfileInput(values, member.membershipId, singleBranchId),
      );
      return { kind: 'saved', name };
    }
    let created = invited.current;
    if (!created) {
      // The check made sure there is a role to invite with.
      const roleId = membershipRoleIdForClinicRoles(values.roleKeys, platformRoles) ?? '';
      created = await invite.mutateAsync({ email: values.email.trim(), roleId });
      invited.current = created;
    }
    await saveProfile.mutateAsync(userProfileInput(values, created.id, singleBranchId));
    invited.current = null;
    return { kind: 'added', name };
  };

  return useDrawerSave<UserFormValues, UserSaveOutcome>({
    form,
    fieldOrder: FIELD_ORDER,
    serverFields: SERVER_FIELDS,
    check,
    onConflict: (error) => {
      const message = mapApiError(error);
      form.setError('email', { type: 'server', message });
      onStep('profile');
      notify.warning(message);
    },
    onField: (field) => onStep(FIELD_STEPS[field as keyof UserFormValues]),
    write,
    onDone,
    toastId: 'user-save-failed',
  });
}
