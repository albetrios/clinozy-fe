import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
import { apiErrorReason, mapApiError } from '@/shared/errors/errorHandler.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useInviteMember } from '@/shared/hooks/useInvitations/index.ts';
import { useUpdateMember } from '@/shared/hooks/useMembers/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { USERS_KEYS, USERS_NS } from '../../users.constants.ts';
import {
  isMobileIncomplete,
  isUserEmail,
  userChangeOf,
  type UserDrawerStepId,
  type UserFormValues,
  userInviteOf,
} from './user-form.ts';

const K = USERS_KEYS.drawer;

/** Which step holds each field — a refused save opens the step of the first one it names. */
const FIELD_STEPS: Readonly<Record<keyof UserFormValues, UserDrawerStepId>> = {
  name: 'profile',
  phone: 'profile',
  email: 'profile',
  tone: 'profile',
  roleIds: 'profile',
  branchIds: 'profile',
  workingDays: 'hours',
  startsAt: 'hours',
  endsAt: 'hours',
  commissionPct: 'hours',
  active: 'hours',
};

/** The form fields in the drawer's order, for "the first field the server named". */
const FIELD_ORDER = Object.keys(FIELD_STEPS) as (keyof UserFormValues)[];

/**
 * clinozy-be's field names that the form spells differently, as the error mapper hands them
 * (`body.work_starts_at` → `workStartsAt`); a name the form shares needs no entry.
 */
const SERVER_FIELDS: Readonly<Record<string, keyof UserFormValues>> = {
  workStartsAt: 'startsAt',
  workEndsAt: 'endsAt',
  commissionPercent: 'commissionPct',
  status: 'active',
};

/** What a save ended with: a member invited, or one saved — by their name (an invitee's email). */
export type UserSaveOutcome =
  { kind: 'added'; name: string } | { kind: 'saved'; name: string };

/** Options of {@link useUserSave}. */
export interface UseUserSaveOptions {
  form: UseFormReturn<UserFormValues>;
  /** The member an edit saves; null for a new user. */
  member: TeamMember | null;
  /** The only open branch: a user is saved on it (`users.md:95`); null with several. */
  singleBranchId: string | null;
  /** Open a step — the one holding the field a check or the server named. */
  onStep: (stepId: UserDrawerStepId) => void;
  /** The save went through; `another` when it was "Create & add another". */
  onDone: (outcome: UserSaveOutcome, another: boolean) => void;
}

/** The user drawer's checks before anything is sent: a role, an email, a ten-digit mobile. */
function useUserChecks() {
  const { t } = useTranslation(USERS_NS);
  return (values: UserFormValues) => {
    if (values.roleIds.length === 0) {
      return { fields: ['roleIds' as const], message: t(K.noRole) };
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
 * The user drawer's writes on the shared drawer save (KICKOFF §6.12 Save, §6.0 States). New: one
 * invitation (`useInviteMember` — the roles and every clinic detail in one call; one idempotency
 * key for the action, so a "Retry save" after a dropped answer never invites twice). Edit: one
 * `PATCH` of what changed, with the read's `updated_at` — the owner's roles and status, and your
 * own status, are never sent. One toast for the whole save — "<name> added" / "<name> saved"
 * (D28). Checks first: a role, an email that reads as one, a mobile of ten digits. An email
 * already in the clinic outlines Email; a stale save says so in our own words.
 */
export function useUserSave({
  form,
  member,
  singleBranchId,
  onStep,
  onDone,
}: UseUserSaveOptions) {
  const writes = { suppressSuccessToast: true, notifyOnError: false } as const;
  const invite = useInviteMember(writes);
  const update = useUpdateMember(writes);
  const check = useUserChecks();

  const write = async (): Promise<UserSaveOutcome> => {
    const values = form.getValues();
    if (member) {
      const change = userChangeOf(member, values, singleBranchId);
      if (change) {
        await update.mutateAsync({ membershipId: member.membershipId, change });
      }
      return { kind: 'saved', name: member.name };
    }
    const created = await invite.mutateAsync(userInviteOf(values, singleBranchId));
    return { kind: 'added', name: created.name };
  };

  return useDrawerSave<UserFormValues, UserSaveOutcome>({
    form,
    fieldOrder: FIELD_ORDER,
    serverFields: SERVER_FIELDS,
    check,
    onConflict: (error) => {
      const message = mapApiError(error);
      // Only "already in the clinic" is the email's fault; a stale save or a full plan is not.
      if (apiErrorReason(error) === 'membership_already_exists') {
        form.setError('email', { type: 'server', message });
        onStep('profile');
      }
      notify.warning(message);
    },
    onField: (field) => onStep(FIELD_STEPS[field as keyof UserFormValues]),
    write,
    onDone,
    toastId: 'user-save-failed',
  });
}
