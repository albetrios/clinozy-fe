import { useQueryClient } from '@tanstack/react-query';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { Role } from '@/shared/api/app/app-schema.ts';
import { branchQueryKeys } from '@/shared/api/app/branches-api.ts';
import type { AppBranch } from '@/shared/api/app/branches-contracts.ts';
import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
import { apiErrorReason, mapApiError } from '@/shared/errors/errorHandler.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { BRANCHES_KEYS, BRANCHES_NS } from '../../branches.constants.ts';
import { useSaveBranch } from '../../hooks/useBranchWrites/index.ts';
import {
  type BranchDrawerStepId,
  type BranchFormValues,
  branchSaveOf,
  isBranchEmailInvalid,
  isBranchPhoneIncomplete,
  isBranchPinIncomplete,
  isBranchReviewLinkInvalid,
} from './branch-form.ts';

const K = BRANCHES_KEYS.drawer;

/** The form's own fields (the defaults sit together on step 3). */
type BranchField = keyof BranchFormValues;

/** Which step holds each field — a refused save opens the step of the first one it names. */
const FIELD_STEPS: Readonly<Record<BranchField, BranchDrawerStepId>> = {
  name: 'place',
  tone: 'place',
  isMain: 'place',
  active: 'place',
  addressLine1: 'place',
  addressLine2: 'place',
  area: 'place',
  city: 'place',
  pin: 'place',
  state: 'place',
  phone: 'contact',
  email: 'contact',
  gstNumber: 'contact',
  reviewLink: 'contact',
  workingDays: 'contact',
  opensAt: 'contact',
  closesAt: 'contact',
  teamIds: 'people',
  defaults: 'people',
};

/** The form fields in the drawer's order, for "the first field the server named". */
const FIELD_ORDER = Object.keys(FIELD_STEPS) as BranchField[];

/**
 * clinozy-be's field names that the form spells differently, as the error mapper hands them
 * (`body.postal_code` → `postalCode`); a name the form shares needs no entry.
 */
const SERVER_FIELDS: Readonly<Record<string, BranchField>> = {
  isActive: 'active',
  addressLineOne: 'addressLine1',
  addressLineTwo: 'addressLine2',
  postalCode: 'pin',
  membershipIds: 'teamIds',
  defaultDoctorMembershipId: 'defaults',
  defaultFrontDeskMembershipId: 'defaults',
  defaultTherapistMembershipId: 'defaults',
  defaultPharmacistMembershipId: 'defaults',
};

/** What a save ended with: a branch added, or one saved — by its name. */
export type BranchSaveOutcome =
  { kind: 'added'; name: string } | { kind: 'saved'; name: string };

/** Options of {@link useBranchSave}. */
export interface UseBranchSaveOptions {
  form: UseFormReturn<BranchFormValues>;
  /** The branch an edit saves; null for a new one. */
  branch: AppBranch | null;
  /** Who worked here when the drawer opened — the team is written only when it changed. */
  before: readonly string[];
  /** The Team, to keep each default on the team with the role. */
  members: readonly TeamMember[];
  /** The preset a role is — who may be each default. */
  presetOf: (roleId: string) => Role | null;
  /** Open a step — the one holding the field a check or the server named. */
  onStep: (stepId: BranchDrawerStepId) => void;
  onDone: (outcome: BranchSaveOutcome) => void;
}

/**
 * The branch drawer's save on the shared drawer save (KICKOFF §6.12 Branch
 * drawer, §6.0 States): checks first — a six-digit PIN code, a phone of ten
 * digits, an email that reads as one — then `saveBranch`. "A branch called Vesu
 * already exists" (409) outlines Name; someone else's save
 * first (409 `record_changed`) offers Reload; a refused field opens its step; a
 * dropped connection keeps the draft with "Retry save". One toast on success:
 * "Vesu branch added" / "Vesu saved".
 */
export function useBranchSave({
  form,
  branch,
  before,
  members,
  presetOf,
  onStep,
  onDone,
}: UseBranchSaveOptions) {
  const { t } = useTranslation(BRANCHES_NS);
  const queryClient = useQueryClient();
  const saveBranch = useSaveBranch();

  return useDrawerSave<BranchFormValues, BranchSaveOutcome>({
    form,
    fieldOrder: FIELD_ORDER,
    serverFields: SERVER_FIELDS,
    check: (values) => {
      if (isBranchPinIncomplete(values.pin)) {
        return { fields: ['pin'], message: t(K.pinInvalid) };
      }
      if (isBranchPhoneIncomplete(values.phone)) {
        return { fields: ['phone'], message: t(K.phoneInvalid) };
      }
      if (isBranchEmailInvalid(values.email)) {
        return { fields: ['email'], message: t(K.emailInvalid) };
      }
      if (isBranchReviewLinkInvalid(values.reviewLink)) {
        return { fields: ['reviewLink'], message: t(K.reviewLinkInvalid) };
      }
      return null;
    },
    onConflict: (error) => {
      // clinozy-be names a taken branch name with no reason (the save never sends `is_main`, so
      // a second main branch can't happen); anything else that conflicts says why.
      if (apiErrorReason(error)) {
        notify.warning(mapApiError(error));
        return;
      }
      const message = t(K.duplicate, { name: form.getValues('name').trim() });
      form.setError('name', { type: 'server', message });
      onStep('place');
      notify.warning(message);
    },
    onStale: () => void queryClient.invalidateQueries({ queryKey: branchQueryKeys.all }),
    onField: (field) => onStep(FIELD_STEPS[field as BranchField]),
    write: async () => {
      const values = form.getValues();
      const team = members.filter((member) =>
        values.teamIds.includes(member.membershipId),
      );
      const saved = await saveBranch.mutateAsync({
        ...(branch ? { branch, memberIdsBefore: before } : {}),
        ...branchSaveOf(values, { team, presetOf }),
      });
      return { kind: branch ? 'saved' : 'added', name: saved.name };
    },
    onDone: (outcome) => onDone(outcome),
    toastId: 'branch-save-failed',
  });
}
