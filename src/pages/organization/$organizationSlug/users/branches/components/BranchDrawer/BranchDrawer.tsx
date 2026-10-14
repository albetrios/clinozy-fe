import type { TFunction } from 'i18next';
import { useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { type HoursFormat, useHoursFormat } from '@/shared/hooks/useHoursFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  type RoleDirectory,
  useRoleDirectory,
} from '../../../shared/hooks/useRoleDirectory/index.ts';
import { BRANCH_DRAWER_TEST_ID, USERS_KEYS, USERS_NS } from '../../../users.constants.ts';
import type { BranchRow } from '../../hooks/useBranchRows/index.ts';
import { useBranchDrawerView } from './branch-drawer-view.ts';
import {
  type BranchDrawerStepId,
  branchFormOf,
  type BranchFormValues,
  emptyBranchForm,
  missingPlaceFields,
} from './branch-form.ts';
import {
  type BranchPlacesAccess,
  isInlineEditEscape,
  type PlaceDraftReport,
  READ_ONLY_PLACES,
  usePlaceDrafts,
} from './branch-places-form.ts';
import { type BranchPlacesView, useBranchPlacesView } from './branch-places-view.ts';
import {
  BranchContactFields,
  BranchPeopleFields,
  BranchPlaceFields,
} from './BranchDrawerFields.tsx';
import { BranchPlacesFields } from './BranchPlacesFields.tsx';
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
  /**
   * Edit only: what "Places & days" offers — add (`branch:create`), rename and switch off
   * (`branch:update`), remove (`branch:delete`). Absent: the lists, read only.
   */
  places?: BranchPlacesAccess;
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
}

/** Props of {@link BranchDrawer}. */
export type BranchDrawerProps = BranchCreateDrawerProps | BranchEditDrawerProps;

/** The branch an edit shows, else null (a new branch, or the list still loading). */
const editedRow = (props: BranchDrawerProps): BranchRow | null =>
  props.mode === 'edit' ? (props.row ?? null) : null;

/** The people who may work at a branch: the active Team, you first. */
function teamCandidates(members: readonly TeamMember[]): TeamMember[] {
  return members
    .filter((member) => member.status === 'active')
    .sort((a, b) => Number(b.isSelf) - Number(a.isSelf));
}

/** A new branch's form, or the edited one's. */
function startingForm(props: BranchDrawerProps, row: BranchRow | null): BranchFormValues {
  if (row) {
    return branchFormOf(
      row.branch,
      row.team.map((member) => member.membershipId),
    );
  }
  const self = props.members.find((member) => member.isSelf);
  return emptyBranchForm({
    branchCount: props.rows.length,
    main: props.rows.find((candidate) => candidate.branch.isMain)?.branch ?? null,
    selfMembershipId: self?.membershipId ?? null,
  });
}

/** The missing-fields toast: the name first, then the address, then the contact. */
function missingKey(values: BranchFormValues): string {
  if (!values.name.trim()) return K.nameMissing;
  return missingPlaceFields(values).length > 0 ? K.addressMissing : K.contactMissing;
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

/** The drawer's three form steps (`users.md:281–288`); "Places & days" follows on an edit. */
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

/**
 * "Places & days" — the fourth step, on an existing branch only (KICKOFF §6.6, D23): its rows
 * save on their own, so it has nothing missing and nothing for the footer's Save.
 */
function placesSteps({
  branchId,
  view,
  access,
  onDraft,
  t,
}: {
  branchId: string | null;
  view: BranchPlacesView;
  access: BranchPlacesAccess;
  onDraft: PlaceDraftReport;
  t: TFunction;
}): DrawerStep[] {
  if (branchId === null) return [];
  return [
    {
      id: 'places',
      title: t(K.steps.places),
      summary: view.summary,
      peek: view.peek,
      content: (
        <BranchPlacesFields
          branchId={branchId}
          view={view}
          access={access}
          onDraft={onDraft}
          testId={BRANCH_DRAWER_TEST_ID}
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
  const readouts = useBranchDrawerView({ values, members: props.members, format });
  // The fourth step's rows save on their own; text typed there and not yet saved still asks.
  const drafts = usePlaceDrafts();
  const placesId = row?.branch.id ?? null;
  const placesView = useBranchPlacesView(placesId);
  const { saveState, save } = useBranchSave({
    form,
    branch: row?.branch ?? null,
    // A new branch has nobody yet: its whole team is sent with it.
    before: row ? initial.teamIds : [],
    members: props.members,
    presetOf: directory.preset,
    onStep: setOpenStep,
    onDone: useSaveOutcome(props),
  });

  return (
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
          : [
              ...branchDrawerSteps({
                form,
                values,
                view: readouts,
                format,
                directory,
                people,
                readOnly,
                idPrefix,
                t,
              }),
              ...placesSteps({
                branchId: placesId,
                view: placesView,
                access: props.access.places ?? READ_ONLY_PLACES,
                onDraft: drafts.report,
                t,
              }),
            ]
      }
      openStep={openStep}
      onOpenStepChange={(step) => setOpenStep(step as BranchDrawerStepId)}
      onMissing={() => notify.warning(t(missingKey(values)))}
      summary={loading ? undefined : readouts.summary}
      readOnly={!loading && readOnly}
      saveLabel={chrome.saveLabel}
      onSave={() => void save()}
      saveState={saveState}
      dirty={isDirty || drafts.dirty}
      onEscapeKeyDown={(event) => {
        // An open rename in "Places & days" cancels on Esc; the drawer stays.
        if (isInlineEditEscape(event)) event.preventDefault();
      }}
      testId={BRANCH_DRAWER_TEST_ID}
    >
      {loading ? (
        <SkeletonRows rows={6} label={chrome.title} rowClassName="h-12" />
      ) : null}
    </RecordDrawer>
  );
}

/**
 * The branch drawer (KICKOFF §6.12 Branch drawer; `users.md:176–198, 226–236`)
 * on the shared record drawer: New branch and Edit branch, three steps —
 * "Branch & address", "Contact & opening hours", "People" — for every role
 * and viewport, and on an existing branch a fourth, "Places & days" (KICKOFF
 * §6.6, D23): its rooms, machines and holidays, each row saved on its own. New starts not main, Open, Mon–Sat 10:00–19:00 in the next
 * tone, City and State from the main branch, you on its team. Save never
 * disables: an empty required field — Name, the address, Area, City, PIN code,
 * Phone, Email — opens its step. A branch is closed, never deleted: Status
 * "Closed". Without the right to write it is view only. Every opening starts a fresh form, once the list
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
