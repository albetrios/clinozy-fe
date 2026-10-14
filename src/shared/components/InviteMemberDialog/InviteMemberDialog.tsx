import { zodResolver } from '@hookform/resolvers/zod';
import { type ReactNode, useId, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { translateFormMessage } from '@/lib/i18n/translate-form-message.ts';
import {
  isInvitableRole,
  type MemberInvite,
} from '@/shared/api/organization-contracts.ts';
import { DrawerField, DrawerInput } from '@/shared/components/DrawerField/index.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { resetFormInPlace } from '@/shared/hooks/useEditingRecord/index.ts';
import { useInviteMember } from '@/shared/hooks/useInvitations/index.ts';
import { useRoles } from '@/shared/hooks/useRoles/index.ts';
import { UserPlus } from '@/shared/icons/index.ts';

const inviteSchema = z.object({
  email: z.email('Enter a valid email address'),
  roleId: z.string().min(1, 'Select a role'),
});

type InviteInput = z.infer<typeof inviteSchema>;

/** Email and role: the light 560px drawer (`_patterns.md:28`). */
const INVITE_FORM_PROFILE = { fieldCount: 2 } as const;

/** Props of {@link InviteMemberDialog} — all optional; without them it is Settings › Members' own. */
export interface InviteMemberDialogProps {
  /**
   * Controlled: the caller opens it (the setup guide's "Invite", feat-clinic-setup KICKOFF §6.2)
   * and there is no "Invite member" button of its own.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The role picked when it opens — "Invite your doctor" picks Doctor. */
  defaultRoleId?: string;
  /**
   * What every invitation sent from here also carries — setup's are the main branch and its days
   * and hours as the member's working hours (D16).
   */
  memberDefaults?: Pick<
    MemberInvite,
    'branchIds' | 'workingDays' | 'workStartsAt' | 'workEndsAt'
  >;
  /** After an invitation is sent. */
  onInvited?: () => void;
}

/**
 * Drawer + form for inviting a new member to the active organization — a child
 * drawer stacked on Settings › Members (L-65), whose Back returns there. Roles
 * come from the organization's real role set (clinozy-be's invite requires
 * `role_ids`), every role but the owner's; an organization without one shows a
 * "create a role first" hint instead of an unusable form. Gated by the caller
 * (render only when the user holds `membership:create` and `role:read`).
 */
export function InviteMemberDialog({
  open: controlledOpen,
  onOpenChange,
  defaultRoleId = '',
  memberDefaults,
  onInvited,
}: InviteMemberDialogProps = {}) {
  const { t } = useTranslation(SETTINGS_NS);
  const [ownOpen, setOwnOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = controlledOpen ?? ownOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setOwnOpen(next);
    onOpenChange?.(next);
  };
  // The email takes focus on open, as it did when this was a dialog.
  const emailRef = useRef<HTMLInputElement | null>(null);
  /** The form the footer's Send submits — Enter in the email sends too. */
  const formId = `invite-form-${useId().replace(/:/g, '')}`;
  const invite = useInviteMember();
  const roles = useRoles();
  const invitableRoles = (roles.rows ?? []).filter(isInvitableRole);
  const hasRoles = invitableRoles.length > 0;

  const form = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', roleId: defaultRoleId },
  });
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = form;
  const { ref: registerEmailRef, ...emailField } = register('email');

  const onSubmit = async (data: InviteInput) => {
    await invite.mutateAsync({
      email: data.email,
      roleIds: [data.roleId],
      ...memberDefaults,
    });
    resetFormInPlace(form, { email: '', roleId: defaultRoleId });
    setOpen(false);
    onInvited?.();
  };

  const showForm = !roles.isPending && hasRoles;
  let body: ReactNode;
  if (roles.isPending) {
    body = (
      <p className="text-muted-foreground text-sm" data-testid="invite-member-loading">
        Loading roles…
      </p>
    );
  } else if (hasRoles) {
    body = (
      <form
        id={formId}
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        data-testid="invite-member-form"
      >
        <DrawerField
          label="Email"
          htmlFor="invite-email"
          error={translateFormMessage(errors.email?.message)}
        >
          <DrawerInput
            id="invite-email"
            type="email"
            capitalize={false}
            placeholder={t(SETTINGS_KEYS.panels.members.emailPlaceholder)}
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'invite-email-error' : undefined}
            data-testid="invite-member-email"
            {...emailField}
            ref={(node) => {
              registerEmailRef(node);
              emailRef.current = node;
            }}
          />
        </DrawerField>

        <DrawerField
          label="Role"
          htmlFor="invite-role"
          error={translateFormMessage(errors.roleId?.message)}
        >
          <Controller
            control={control}
            name="roleId"
            render={({ field }) => (
              <Picker
                id="invite-role"
                label="Role"
                value={field.value || null}
                options={invitableRoles.map((role) => ({
                  key: role.id,
                  label: role.name,
                }))}
                plain
                placeholder={t(SETTINGS_KEYS.panels.members.rolePlaceholder)}
                onChange={(key) => field.onChange(key ?? '')}
                invalid={!!errors.roleId}
                aria-describedby={errors.roleId ? 'invite-role-error' : undefined}
                testId="invite-member-role"
                className="w-full"
              />
            )}
          />
          {/* An organization with no Member and no Viewer opens with no role
              chosen, and `handleSubmit` then blocks the send: the field says
              why (its error line), as the Email field above always has. */}
        </DrawerField>
      </form>
    );
  } else if (roles.isError) {
    // "Create a role first" is a claim about the organization. A failed fetch is
    // not evidence for it — the roles almost certainly exist (SET-11).
    body = (
      <div data-testid="invite-member-roles-error">
        <RetryError
          message={t(SETTINGS_KEYS.panels.roles.loadFailed)}
          onRetry={roles.refetch}
          isRetrying={roles.isFetching}
        />
      </div>
    );
  } else {
    body = (
      <div className="space-y-3" data-testid="invite-member-no-roles">
        <p className="text-muted-foreground text-sm">
          You need a role to assign before inviting anyone. Create one in the{' '}
          <span className="text-foreground font-medium">Roles</span> tab, then come back
          here.
        </p>
      </div>
    );
  }

  // Send sits in the drawer's footer while the form shows; every other state
  // (loading, a failed read, no role to assign) offers only Back.
  return (
    <>
      {isControlled ? null : (
        <Button size="sm" onClick={() => setOpen(true)} data-testid="invite-member-open">
          <UserPlus className="size-4" />
          Invite member
        </Button>
      )}
      <RecordDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Invite a member"
        sub="Send an email invitation to join this organization."
        content={INVITE_FORM_PROFILE}
        stacked
        initialFocusRef={emailRef}
        saveLabel="Send invitation"
        savingLabel="Sending…"
        saveFormId={showForm ? formId : undefined}
        saveState={isSubmitting ? 'saving' : 'idle'}
        saveTestId="invite-member-submit"
        testId="invite-member-dialog"
      >
        {body}
      </RecordDrawer>
    </>
  );
}
