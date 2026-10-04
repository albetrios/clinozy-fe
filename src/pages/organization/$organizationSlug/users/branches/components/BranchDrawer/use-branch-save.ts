import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import { useSaveBranch } from '../../hooks/useBranchWrites/index.ts';
import {
  type BranchDrawerStepId,
  type BranchFormValues,
  branchSaveOf,
  isBranchEmailInvalid,
  isBranchPhoneIncomplete,
} from './branch-form.ts';

const K = USERS_KEYS.branches.drawer;

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
  workingDays: 'contact',
  opensAt: 'contact',
  closesAt: 'contact',
  teamIds: 'people',
  defaults: 'people',
};

/** The form fields in the drawer's order, for "the first field the server named". */
const FIELD_ORDER = Object.keys(FIELD_STEPS) as BranchField[];

/** The contract's field names that the form spells differently. */
const SERVER_FIELDS: Readonly<Record<string, BranchField>> = {
  defaultDoctorId: 'defaults',
  defaultDeskId: 'defaults',
  defaultTherapistId: 'defaults',
  defaultPharmacistId: 'defaults',
};

/** What a save ended with: a branch added, or one saved — by its name. */
export type BranchSaveOutcome =
  { kind: 'added'; name: string } | { kind: 'saved'; name: string };

/** Options of {@link useBranchSave}. */
export interface UseBranchSaveOptions {
  form: UseFormReturn<BranchFormValues>;
  /** The branch an edit saves; null for a new one. */
  branch: Branch | null;
  /** Who worked here when the drawer opened — the Team change is against it. */
  before: readonly string[];
  /** The Team, to keep each default on the team with the role. */
  members: readonly TeamMember[];
  /** Open a step — the one holding the field a check or the server named. */
  onStep: (stepId: BranchDrawerStepId) => void;
  onDone: (outcome: BranchSaveOutcome) => void;
}

/**
 * The branch drawer's save on the shared drawer save (KICKOFF §6.12 Branch
 * drawer, §6.0 States): checks first — a phone of ten digits, an email that
 * reads as one — then `saveBranch`. "A branch called Vesu already exists"
 * (409) outlines Name; a refused field opens its step; a dropped connection
 * keeps the draft with "Retry save". One toast on success: "Vesu branch
 * added" / "Vesu saved".
 */
export function useBranchSave({
  form,
  branch,
  before,
  members,
  onStep,
  onDone,
}: UseBranchSaveOptions) {
  const { t } = useTranslation(USERS_NS);
  const saveBranch = useSaveBranch();

  return useDrawerSave<BranchFormValues, BranchSaveOutcome>({
    form,
    fieldOrder: FIELD_ORDER,
    serverFields: SERVER_FIELDS,
    check: (values) => {
      if (isBranchPhoneIncomplete(values.phone)) {
        return { fields: ['phone'], message: t(K.phoneInvalid) };
      }
      if (isBranchEmailInvalid(values.email)) {
        return { fields: ['email'], message: t(K.emailInvalid) };
      }
      return null;
    },
    onConflict: () => {
      const message = t(K.duplicate, { name: form.getValues('name').trim() });
      form.setError('name', { type: 'server', message });
      onStep('place');
      notify.warning(message);
    },
    onField: (field) => onStep(FIELD_STEPS[field as BranchField]),
    write: async () => {
      const values = form.getValues();
      const team = members.filter(
        (member) => member.profile && values.teamIds.includes(member.profile.id),
      );
      const saved = await saveBranch.mutateAsync({
        ...(branch ? { id: branch.id } : {}),
        ...branchSaveOf(values, { team, before }),
      });
      return { kind: branch ? 'saved' : 'added', name: saved.name };
    },
    onDone: (outcome) => onDone(outcome),
    toastId: 'branch-save-failed',
  });
}
