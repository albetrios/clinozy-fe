import type { TFunction } from 'i18next';
import { useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import { staffInitials } from '@/shared/api/clinic/users-contracts.ts';
import { defaultBranchId } from '@/shared/clinic/clinic-branch.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import type { QuickFillItem } from '@/shared/components/QuickFillRow/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { resetFormInPlace } from '@/shared/hooks/useEditingRecord/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { useResendInvitation } from '@/shared/hooks/useInvitations/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { usePlatformRoles } from '@/shared/hooks/useTeam/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useHoursFormat } from '../../shared/hooks/useHoursFormat/index.ts';
import {
  type RoleDirectory,
  useRoleDirectory,
} from '../../shared/hooks/useRoleDirectory/index.ts';
import { USER_DRAWER_TEST_ID, USERS_KEYS, USERS_NS } from '../../users.constants.ts';
import type { UserDeleteTarget } from '../UserDeleteConfirm/index.ts';
import { type UserSaveOutcome, useUserSave } from './use-user-save.ts';
import { useUserDrawerView } from './user-drawer-view.ts';
import {
  emptyUserForm,
  USER_QUICK_FILLS,
  type UserDrawerStepId,
  userFormOf,
  type UserFormValues,
} from './user-form.ts';
import { UserHoursFields, UserProfileFields } from './UserDrawerFields.tsx';

const K = USERS_KEYS.drawer;

/** The Users room's section tone (`users.md:11`): the open step's circle. */
const USERS_TONE = 'slate';

/** Thirteen fields, chip groups among them: the everyday 680px (`users.md:167`). */
const CONTENT_PROFILE = { fieldCount: 12, hasHeavyField: true } as const;

/** What the room decides about the drawer: who may write, and the member's limits. */
export interface UserDrawerAccess {
  /**
   * The access is known. Until it is the drawer shows its skeleton — an
   * unresolved "no" is "not known yet", never "view only".
   */
  resolved: boolean;
  /** New: "New user" is allowed; edit: the member may be edited. Else view only. */
  canWrite: boolean;
  /** Delete on an edit (never the owner's or your own row). */
  canDelete: boolean;
  /** "Leave clinic" in its place on your own drawer — never the owner's (D17). */
  canLeave: boolean;
  /** "Resend invitation" on an invited member. */
  canResend: boolean;
}

interface UserDrawerBaseProps {
  open: boolean;
  /** Every exit, once the dirty guard has let it through. */
  onClose: () => void;
  access: UserDrawerAccess;
}

/** New user (`users/create/`): an invitation, never a password (D17). */
interface UserCreateDrawerProps extends UserDrawerBaseProps {
  mode: 'create';
  /** Saved: the room closes the drawer; the list stays (D28). */
  onCreated: () => void;
}

/** Edit user (`users/$userId/edit/`). */
interface UserEditDrawerProps extends UserDrawerBaseProps {
  mode: 'edit';
  /** Undefined while the Team is still loading — the drawer shows its skeleton. */
  member: TeamMember | undefined;
  onSaved: () => void;
  /**
   * The footer's Delete: the room opens its delete confirm, which outlives
   * the drawer for the 10s Undo, and closes the drawer once it is scheduled.
   */
  onDelete: (target: UserDeleteTarget) => void;
  /** "Leave clinic" on your own drawer: the room opens its leave confirm. */
  onLeave: (member: TeamMember) => void;
}

/** Props of {@link UserDrawer}. */
export type UserDrawerProps = UserCreateDrawerProps | UserEditDrawerProps;

type SessionProps = UserDrawerProps & {
  /** The access and the branches are known — the form may start. */
  ready: boolean;
  onAnother: () => void;
};

/**
 * The Quick fill chips (new only): each sets the preset's role — the clinic's role of that name,
 * when it still has one — days, hours and commission; never the colour.
 */
function quickFillItems(
  form: UseFormReturn<UserFormValues>,
  directory: RoleDirectory,
  t: TFunction,
): QuickFillItem[] {
  return USER_QUICK_FILLS.map((fill) => ({
    id: fill.id,
    label: t(K.quickFill[fill.id]),
    tone: fill.tone,
    onSelect: () => {
      const current = form.getValues();
      const roleId = directory.presetRoleId(fill.role);
      resetFormInPlace(
        form,
        { ...current, ...fill.values, roleIds: roleId ? [roleId] : current.roleIds },
        { keepDefaultValues: true, keepErrors: true },
      );
    },
  }));
}

/** The member an edit shows, else null (a new user, or the Team still loading). */
const editedMember = (props: UserDrawerProps): TeamMember | null =>
  props.mode === 'edit' ? (props.member ?? null) : null;

/** The drawer's words and mode-only parts for each use (`users.md:169–170`). */
function drawerChrome(
  props: UserDrawerProps,
  member: TeamMember | null,
  ready: boolean,
  t: TFunction,
) {
  const create = props.mode === 'create';
  return {
    create,
    /**
     * Access or branches unknown yet, or an edit with the Team still loading:
     * the skeleton, no steps — the form starts once it knows its defaults.
     */
    loading: !ready || (props.mode === 'edit' && !member),
    title: create ? t(K.title.create) : t(K.title.edit),
    tag: member && member.seq !== null ? displayId.user(member.seq) : undefined,
    saveLabel: create ? t(K.save.create) : t(K.save.edit),
  };
}

/** What follows a save: its toast — the person's full name (D28) — then the caller's hand-off. */
function useSaveOutcome(props: UserDrawerProps, onAnother: () => void) {
  const { t } = useTranslation(USERS_NS);
  return (outcome: UserSaveOutcome, another: boolean) => {
    notify.success(
      outcome.kind === 'added'
        ? t(K.added, { name: outcome.name })
        : t(K.saved, { name: outcome.name }),
    );
    if (props.mode === 'edit') props.onSaved();
    else if (another) onAnother();
    else props.onCreated();
  };
}

/** The data the drawer's fields and read-outs share. */
function useDrawerData() {
  const { openBranches, isMultiBranch } = useBranches();
  const { preferences } = usePreferences();
  const directory = useRoleDirectory();
  const format = useHoursFormat();
  return {
    openBranches,
    isMultiBranch,
    /** With one open branch a user is saved on it (`users.md:95`). */
    singleBranchId: isMultiBranch ? null : (openBranches[0]?.id ?? null),
    defaultBranchId: defaultBranchId(openBranches, preferences.branchFilter),
    directory,
    format,
  };
}

/** The drawer's two step cards (`users.md:274–275`). */
function userDrawerSteps({
  form,
  values,
  member,
  data,
  view,
  access,
  resend,
  idPrefix,
  t,
}: {
  form: UseFormReturn<UserFormValues>;
  values: UserFormValues;
  member: TeamMember | null;
  data: ReturnType<typeof useDrawerData>;
  view: ReturnType<typeof useUserDrawerView>;
  access: UserDrawerAccess;
  resend: ReturnType<typeof useResendInvitation>;
  idPrefix: string;
  t: TFunction;
}): DrawerStep[] {
  const shared = {
    form,
    values,
    idPrefix,
    testId: USER_DRAWER_TEST_ID,
    readOnly: !access.canWrite,
  };
  return [
    {
      id: 'profile',
      title: t(K.steps.profile),
      ...view.profile,
      content: (
        <UserProfileFields
          {...shared}
          showName={member !== null}
          emailLocked={member !== null && member.status !== 'invited'}
          rolesLocked={member?.isOwner ?? false}
          initials={staffInitials(values.name)}
          roleOptions={data.directory.options}
          access={view.access}
          branches={data.openBranches}
          multiBranch={data.isMultiBranch}
        />
      ),
    },
    {
      id: 'hours',
      title: t(K.steps.hours),
      ...view.hours,
      content: (
        <UserHoursFields
          {...shared}
          format={data.format}
          member={member}
          statusLocked={member !== null && (member.isOwner || member.isSelf)}
          canResend={access.canResend}
          resending={resend.isPending}
          onResend={() => {
            if (member?.invitation) resend.mutate(member.membershipId);
          }}
        />
      ),
    },
  ];
}

/**
 * The footer's destructive button — Delete on someone else's drawer, "Leave
 * clinic" on your own (never the owner's, D17). It hands the member to the
 * room, whose confirm outlives this drawer: the removal waits out its 10s
 * Undo in the confirm, and a confirm inside the drawer was unmounted — the
 * removal cancelled — the moment the drawer closed (L-64).
 */
function useDrawerExit(
  props: UserDrawerProps,
  member: TeamMember | null,
  record?: string,
) {
  const { t } = useTranslation(USERS_NS);
  if (props.mode !== 'edit' || !member)
    return { onDelete: undefined, deleteLabel: undefined };
  if (props.access.canDelete) {
    return { onDelete: () => props.onDelete({ member, record }), deleteLabel: undefined };
  }
  if (props.access.canLeave) {
    return {
      onDelete: () => props.onLeave(member),
      deleteLabel: t(USERS_KEYS.rowActions.leave),
    };
  }
  return { onDelete: undefined, deleteLabel: undefined };
}

/** One opening of the drawer: the form, its checks and its save. */
function UserDrawerSession(props: SessionProps) {
  const { ready, onAnother } = props;
  const { t } = useTranslation(USERS_NS);
  const member = editedMember(props);
  const data = useDrawerData();
  const idPrefix = `user-${useId().replace(/:/g, '')}`;
  const chrome = drawerChrome(props, member, ready, t);

  const form = useForm<UserFormValues>({
    defaultValues: member
      ? userFormOf(member)
      : emptyUserForm(data.defaultBranchId, data.directory.presetRoleId('front_desk')),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<UserDrawerStepId>('profile');
  const resend = useResendInvitation();
  const view = useUserDrawerView({
    values,
    rolePills: data.directory.pills,
    branches: data.openBranches,
    multiBranch: data.isMultiBranch,
    format: data.format,
  });
  const { saveState, save } = useUserSave({
    form,
    member,
    singleBranchId: data.singleBranchId,
    onStep: setOpenStep,
    onDone: useSaveOutcome(props, onAnother),
  });
  // Still loading: no badges, no summary, no steps — the skeleton.
  const readouts = chrome.loading
    ? { badges: [], summary: undefined }
    : { badges: view.badges, summary: view.summary };
  const exit = useDrawerExit(props, member, readouts.summary);
  const steps = chrome.loading
    ? []
    : userDrawerSteps({
        form,
        values,
        member,
        data,
        view,
        access: props.access,
        resend,
        idPrefix,
        t,
      });

  return (
    <RecordDrawer
      open={props.open}
      onClose={props.onClose}
      title={chrome.title}
      tag={chrome.tag}
      sub={t(K.sub)}
      badges={readouts.badges}
      quickFill={chrome.create ? quickFillItems(form, data.directory, t) : undefined}
      content={CONTENT_PROFILE}
      tone={USERS_TONE}
      steps={steps}
      openStep={openStep}
      onOpenStepChange={(step) => setOpenStep(step as UserDrawerStepId)}
      onMissing={() => notify.warning(t(K.missing))}
      summary={readouts.summary}
      readOnly={!(chrome.loading || props.access.canWrite)}
      saveLabel={chrome.saveLabel}
      onSave={() => void save(false)}
      saveState={saveState}
      saveAndAddLabel={t(K.save.createAnother)}
      onSaveAndAdd={chrome.create ? () => void save(true) : undefined}
      onDelete={exit.onDelete}
      deleteLabel={exit.deleteLabel}
      dirty={isDirty}
      testId={USER_DRAWER_TEST_ID}
    >
      {chrome.loading ? (
        <SkeletonRows rows={6} label={chrome.title} rowClassName="h-12" />
      ) : null}
    </RecordDrawer>
  );
}

/**
 * The user drawer (KICKOFF §6.12; `users.md:99–124, 160–174, 272–279`) on the
 * shared record drawer: New user — an invitation, never a password (D17) —
 * and Edit user, one form in two steps, "Profile, roles & branches" and
 * "Working hours & pay", for every role and viewport. New starts as Front
 * desk (the clinic's role of that name), sky, Mon–Sat 10:00–19:00 on the
 * header's branch, with the Quick fill presets; Edit opens on step 1, the name
 * read-only — the person sets it on their own profile. Save never disables: an
 * empty Email opens step 1 with "Add their email". Without the right to write it
 * is view only. Every opening starts a fresh form; "Create & add another"
 * restarts it.
 */
export function UserDrawer(props: UserDrawerProps) {
  const branches = useBranches();
  const roles = usePlatformRoles();
  const { session, restart } = useDrawerSession(props.open);
  // The form starts from what is known: a fresh one once the access, the branches and roles (a
  // new user's defaults) or the member (an edit) arrive.
  const ready = props.access.resolved && !branches.isPending && !roles.isPending;
  const startsFrom = `${String(ready)}:${props.mode === 'edit' ? (props.member?.membershipId ?? '') : ''}`;
  return (
    <UserDrawerSession
      key={`${session}-${startsFrom}`}
      {...props}
      ready={ready}
      onAnother={restart}
    />
  );
}
