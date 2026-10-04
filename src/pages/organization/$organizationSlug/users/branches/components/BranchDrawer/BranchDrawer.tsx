import type { TFunction } from 'i18next';
import { useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  type HoursFormat,
  useHoursFormat,
} from '../../../shared/hooks/useHoursFormat/index.ts';
import {
  type RoleDirectory,
  useRoleDirectory,
} from '../../../shared/hooks/useRoleDirectory/index.ts';
import { BRANCH_DRAWER_TEST_ID, USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import type { BranchRow } from '../../hooks/useBranchRows/index.ts';
import { BranchDeleteConfirm } from '../BranchDeleteConfirm/index.ts';
import { useBranchDrawerView } from './branch-drawer-view.ts';
import {
  type BranchDrawerStepId,
  branchFormOf,
  type BranchFormValues,
  emptyBranchForm,
} from './branch-form.ts';
import {
  BranchContactFields,
  BranchPeopleFields,
  BranchPlaceFields,
} from './BranchDrawerFields.tsx';
import { type BranchSaveOutcome, useBranchSave } from './use-branch-save.ts';

const K = USERS_KEYS.branches.drawer;

/** The Users room's section tone (`users.md:11`): the open step's circle. */
const USERS_TONE = 'slate';

/** Twenty-one fields, chip groups and people pickers among them: the everyday 680px. */
const CONTENT_PROFILE = { fieldCount: 21, hasHeavyField: true } as const;

/** What the page decides about the drawer: who may write. */
export interface BranchDrawerAccess {
  /** The access is known; until it is the drawer shows its skeleton. */
  resolved: boolean;
  /** New: "New branch" is allowed; edit: the branch may be edited. Else view only. */
  canWrite: boolean;
  /** Delete on an edit — never the main branch. */
  canDelete: boolean;
}

interface BranchDrawerBaseProps {
  open: boolean;
  /** Every exit, once the dirty guard has let it through. */
  onClose: () => void;
  access: BranchDrawerAccess;
  /** Every branch's row, for the main branch's City and State and the next tone. */
  rows: readonly BranchRow[];
  /** The Team — who may work here. */
  members: readonly TeamMember[];
  /** The rows and the Team have loaded. */
  ready: boolean;
}

/** New branch (`users/branches/create/`). */
export interface BranchCreateDrawerProps extends BranchDrawerBaseProps {
  mode: 'create';
  onCreated: () => void;
}

/** Edit branch (`users/branches/$branchId/edit/`). */
export interface BranchEditDrawerProps extends BranchDrawerBaseProps {
  mode: 'edit';
  /** Undefined while the list is still loading — the drawer shows its skeleton. */
  row: BranchRow | undefined;
  onSaved: () => void;
  /** Deleted from the drawer (its Delete, with Undo in the toast). */
  onDeleted: () => void;
}

/** Props of {@link BranchDrawer}. */
export type BranchDrawerProps = BranchCreateDrawerProps | BranchEditDrawerProps;

/** The form's values as they stand, every key present (the form starts with all of them). */
function useFormValues(form: UseFormReturn<BranchFormValues>): BranchFormValues {
  const watched = useWatch({ control: form.control });
  return { ...form.getValues(), ...watched } as BranchFormValues;
}

/** The branch an edit shows, else null (a new branch, or the list still loading). */
const editedRow = (props: BranchDrawerProps): BranchRow | null =>
  props.mode === 'edit' ? (props.row ?? null) : null;

/** The people who may work at a branch: active Team members with a profile, you first. */
function teamCandidates(members: readonly TeamMember[]): TeamMember[] {
  return members
    .filter((member) => member.status === 'active' && member.profile !== null)
    .sort((a, b) => Number(b.isSelf) - Number(a.isSelf));
}

/** A new branch's form, or the edited one's. */
function startingForm(props: BranchDrawerProps, row: BranchRow | null): BranchFormValues {
  if (row) {
    return branchFormOf(
      row.branch,
      row.team.flatMap((member) => (member.profile ? [member.profile.id] : [])),
    );
  }
  const self = props.members.find((member) => member.isSelf && member.profile);
  return emptyBranchForm({
    branchCount: props.rows.length,
    main: props.rows.find((candidate) => candidate.branch.isMain)?.branch ?? null,
    selfProfileId: self?.profile?.id ?? null,
  });
}

/** What follows a save: its toast, then the caller's hand-off. */
function useSaveOutcome(props: BranchDrawerProps) {
  const { t } = useTranslation(USERS_NS);
  return (outcome: BranchSaveOutcome) => {
    notify.success(
      outcome.kind === 'added'
        ? t(K.added, { name: outcome.name })
        : t(K.saved, { name: outcome.name }),
    );
    if (props.mode === 'edit') props.onSaved();
    else props.onCreated();
  };
}

/** The drawer's three step cards (`users.md:281–288`). */
function branchDrawerSteps({
  form,
  values,
  view,
  format,
  directory,
  people,
  readOnly,
  idPrefix,
  t,
}: {
  form: UseFormReturn<BranchFormValues>;
  values: BranchFormValues;
  view: ReturnType<typeof useBranchDrawerView>;
  format: HoursFormat;
  directory: RoleDirectory;
  people: readonly TeamMember[];
  readOnly: boolean;
  idPrefix: string;
  t: TFunction;
}): DrawerStep[] {
  return [
    {
      id: 'place',
      title: t(K.steps.place),
      ...view.place,
      content: (
        <BranchPlaceFields
          form={form}
          values={values}
          idPrefix={idPrefix}
          testId={BRANCH_DRAWER_TEST_ID}
          readOnly={readOnly}
        />
      ),
    },
    {
      id: 'contact',
      title: t(K.steps.contact),
      ...view.contact,
      content: (
        <BranchContactFields
          form={form}
          values={values}
          idPrefix={idPrefix}
          testId={BRANCH_DRAWER_TEST_ID}
          readOnly={readOnly}
          format={format}
        />
      ),
    },
    {
      id: 'people',
      title: t(K.steps.people),
      ...view.people,
      content: (
        <BranchPeopleFields
          form={form}
          values={values}
          idPrefix={idPrefix}
          testId={BRANCH_DRAWER_TEST_ID}
          readOnly={readOnly}
          people={people}
          directory={directory}
        />
      ),
    },
  ];
}

/** The drawer's words and mode-only parts (`users.md:228–236`). */
function drawerChrome(props: BranchDrawerProps, row: BranchRow | null, t: TFunction) {
  const create = props.mode === 'create';
  return {
    /** The list, the Team or the access unknown, or an edit still loading: the skeleton. */
    loading: !(props.ready && props.access.resolved && (create || row !== null)),
    title: create ? t(K.title.create) : t(K.title.edit),
    saveLabel: create ? t(K.save.create) : t(K.save.edit),
    readOnly: !props.access.canWrite,
    /** Delete on an edit — never the main branch. */
    canDelete: row !== null && !row.branch.isMain && props.access.canDelete,
  };
}

/** One opening of the drawer: the form, its checks and its save. */
function BranchDrawerSession(props: BranchDrawerProps) {
  const { t } = useTranslation(USERS_NS);
  const row = editedRow(props);
  const chrome = drawerChrome(props, row, t);
  const { loading, readOnly } = chrome;
  const idPrefix = `branch-${useId().replace(/:/g, '')}`;
  const format = useHoursFormat();
  const directory = useRoleDirectory();
  const people = teamCandidates(props.members);
  const [initial] = useState(() => startingForm(props, row));
  const form = useForm<BranchFormValues>({ defaultValues: initial });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<BranchDrawerStepId>('place');
  const [deleting, setDeleting] = useState(false);
  const readouts = useBranchDrawerView({ values, members: props.members, format });
  const { saveState, save } = useBranchSave({
    form,
    branch: row?.branch ?? null,
    // A new branch has nobody yet: its whole team is added.
    before: row ? initial.teamIds : [],
    members: props.members,
    onStep: setOpenStep,
    onDone: useSaveOutcome(props),
  });

  return (
    <>
      <RecordDrawer
        open={props.open}
        onClose={props.onClose}
        title={chrome.title}
        tag={row ? row.branch.name : undefined}
        sub={t(K.sub)}
        badges={loading ? [] : readouts.badges}
        content={CONTENT_PROFILE}
        tone={USERS_TONE}
        steps={
          loading
            ? []
            : branchDrawerSteps({
                form,
                values,
                view: readouts,
                format,
                directory,
                people,
                readOnly,
                idPrefix,
                t,
              })
        }
        openStep={openStep}
        onOpenStepChange={(step) => setOpenStep(step as BranchDrawerStepId)}
        onMissing={() =>
          notify.warning(values.name.trim() ? t(K.addressMissing) : t(K.nameMissing))
        }
        summary={loading ? undefined : readouts.summary}
        readOnly={!loading && readOnly}
        saveLabel={chrome.saveLabel}
        onSave={() => void save()}
        saveState={saveState}
        onDelete={chrome.canDelete ? () => setDeleting(true) : undefined}
        dirty={isDirty}
        testId={BRANCH_DRAWER_TEST_ID}
      >
        {loading ? (
          <SkeletonRows rows={6} label={chrome.title} rowClassName="h-12" />
        ) : null}
      </RecordDrawer>
      <BranchDeleteConfirm
        target={deleting && row ? { branch: row.branch, record: readouts.summary } : null}
        onClose={() => setDeleting(false)}
        onDeleted={() => {
          setDeleting(false);
          if (props.mode === 'edit') props.onDeleted();
        }}
      />
    </>
  );
}

/**
 * The branch drawer (KICKOFF §6.12 Branch drawer; `users.md:176–198, 226–236`)
 * on the shared record drawer: New branch and Edit branch, always three steps
 * — "Branch & address", "Contact & opening hours", "People" — for every role
 * and viewport. New starts not main, Open, Mon–Sat 10:00–19:00 in the next
 * tone, City and State from the main branch, you on its team. Save never
 * disables: an empty Name or Address line 1 opens step 1. Without the right
 * to write it is view only. Every opening starts a fresh form, once the list
 * and the Team are known.
 */
export function BranchDrawer(props: BranchDrawerProps) {
  const { session } = useDrawerSession(props.open);
  // The form starts from what is known: a fresh one once the list, the Team
  // and the access (a new branch's defaults) or the branch (an edit) arrive.
  const ready = props.ready && props.access.resolved;
  const startsFrom = `${String(ready)}:${props.mode === 'edit' ? (props.row?.branch.id ?? '') : ''}`;
  return <BranchDrawerSession key={`${session}-${startsFrom}`} {...props} />;
}
