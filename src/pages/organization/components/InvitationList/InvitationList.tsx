import { useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { queryClient } from '@/core/http/queryClient.ts';
import { cn } from '@/lib/utils.ts';
import { toneForLabel } from '@/shared/app/app-tone-label.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { AUTH_KEYS, AUTH_NS } from '@/shared/auth/auth-shell.constants.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { Spinner } from '@/shared/components/Spinner/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { notifyError, reportError } from '@/shared/errors/errorHandler.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { Building } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { acceptInvitationAndOpenClinic } from '@/shared/tenancy/accept-invitation.ts';
import type { OrganizationSummary } from '@/shared/tenancy/me-context.ts';
import {
  declineInvitation,
  invalidateMyInvitations,
  type MyInvitation,
  myInvitationsQueryKey,
} from '@/shared/tenancy/my-invitations.ts';
import { myOrganizationsQueryKey } from '@/shared/tenancy/my-organization-summaries.ts';

/** Whether the person belonged to a clinic before this accept — read from the cached list. */
function hadClinicBefore(): boolean {
  const organizations =
    queryClient.getQueryData<OrganizationSummary[]>(myOrganizationsQueryKey) ?? [];
  return organizations.some((organization) => organization.type === 'TEAM');
}

/**
 * Accepting and declining from the picker. Accept joins the clinic and moves this tab into it.
 * Someone who already had a clinic stays here: the new clinic joins the list, and they choose
 * which opens at sign-in — and which to open now (feat-choose-default-clinic). For a first
 * clinic it hands off to `/` — the resolver runs onboarding's profile steps for someone who has
 * not finished it, else opens the clinic's home. Decline ends the invitation (the inviter is
 * told); with none left the resolver decides what is next (onboarding, or the clinic already
 * active).
 */
function useInvitationResponse() {
  const { t } = useTranslation(AUTH_NS);
  const navigate = useNavigate();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  // Single-flight, flipped synchronously: two accepts cannot both be sent from one gesture.
  const busyRef = useRef(false);

  async function accept(invitation: MyInvitation): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setAcceptingId(invitation.id);
    // Read before the accept refreshes the list.
    const staysToChoose = hadClinicBefore();
    try {
      const accepted = await acceptInvitationAndOpenClinic(invitation.id);
      if (staysToChoose && !accepted.switchError) {
        notify.success(
          t(AUTH_KEYS.organizationPicker.joined, { name: invitation.organization.name }),
        );
        return;
      }
      if (accepted.switchError) {
        // Joined all the same; say so and let the resolver find the way in.
        reportError(accepted.switchError, {
          scope: 'organization-picker.invitation-accept.switch',
          invitation_id: invitation.id,
          organization_id: accepted.organizationId,
        });
        notify.warning(t(AUTH_KEYS.acceptInvite.switchFailedToast));
      }
      await navigate({ to: '/', replace: true });
    } catch (error) {
      reportError(error, { scope: 'organization-picker.invitation-accept' });
      notifyError(error);
      // An invitation that turned out expired or revoked leaves the list.
      void invalidateMyInvitations();
    } finally {
      busyRef.current = false;
      setAcceptingId(null);
    }
  }

  async function decline(invitation: MyInvitation): Promise<void> {
    try {
      await declineInvitation(invitation.id);
    } catch (error) {
      notifyError(error);
      throw error;
    }
    notify.success(t(AUTH_KEYS.organizationPicker.declined));
    await invalidateMyInvitations();
    const remaining =
      queryClient.getQueryData<MyInvitation[]>(myInvitationsQueryKey) ?? [];
    if (remaining.length === 0) await navigate({ to: '/', replace: true });
  }

  return { acceptingId, accept, decline };
}

/** One invitation: the clinic, the roles and who invited, the expiry, then Accept and Decline. */
function InvitationRow({
  invitation,
  accepting,
  disabled,
  onAccept,
  onDecline,
}: {
  invitation: MyInvitation;
  accepting: boolean;
  disabled: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation(AUTH_NS);
  const { formatDate } = useLocaleFormat();
  const { name } = invitation.organization;
  const details = [
    invitation.roleNames.join(', '),
    invitation.inviterName
      ? t(AUTH_KEYS.organizationPicker.invitedBy, { name: invitation.inviterName })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className="flex min-w-0 flex-col gap-2 rounded-lg border py-1.5 ps-1.5 pe-2"
      data-testid={`organization-picker-invitation-${invitation.id}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 flex-none items-center justify-center rounded-md',
            TONE_CLASSES[toneForLabel(name)].surface,
          )}
        >
          <Building className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span dir="auto" className="text-body truncate leading-[1.3] font-semibold">
            {name}
          </span>
          {details ? (
            <span className="text-muted-foreground text-caption truncate leading-[1.3]">
              {details}
            </span>
          ) : null}
          <span className="text-muted-foreground text-caption leading-[1.3]">
            {t(AUTH_KEYS.organizationPicker.expires, {
              date: formatDate(invitation.expiresAt),
            })}
          </span>
        </span>
      </div>
      <div className="flex justify-end gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDecline}
          disabled={disabled}
          data-testid={`organization-picker-invitation-decline-${invitation.id}`}
        >
          {t(AUTH_KEYS.organizationPicker.decline)}
        </Button>
        <Button
          size="sm"
          onClick={onAccept}
          disabled={disabled}
          aria-busy={accepting}
          data-testid={`organization-picker-invitation-accept-${invitation.id}`}
        >
          {accepting ? <Spinner /> : null}
          {t(AUTH_KEYS.organizationPicker.accept)}
        </Button>
      </div>
    </div>
  );
}

/**
 * The person's pending invitations on the organization picker (clinozy-be launch D84): a person
 * with no clinic who was invited lands here instead of the onboarding that would create one, and
 * a member of another clinic reaches it from the switcher's "Invited" rows.
 */
export function InvitationList({
  invitations,
}: {
  invitations: readonly MyInvitation[];
}) {
  const { t } = useTranslation(AUTH_NS);
  const { acceptingId, accept, decline } = useInvitationResponse();
  const [declining, setDeclining] = useState<MyInvitation | null>(null);

  return (
    <section
      aria-label={t(AUTH_KEYS.organizationPicker.invitationsTitle)}
      className="flex flex-col gap-1.5"
      data-testid="organization-picker-invitations"
    >
      <h2 className="text-muted-foreground text-caption px-1.5 font-medium">
        {t(AUTH_KEYS.organizationPicker.invitationsTitle)}
      </h2>
      {invitations.map((invitation) => (
        <InvitationRow
          key={invitation.id}
          invitation={invitation}
          accepting={acceptingId === invitation.id}
          disabled={acceptingId !== null}
          onAccept={() => void accept(invitation)}
          onDecline={() => setDeclining(invitation)}
        />
      ))}
      <ConfirmDialog
        open={declining !== null}
        onOpenChange={(open) => {
          if (!open) setDeclining(null);
        }}
        title={t(AUTH_KEYS.organizationPicker.declineTitle, {
          name: declining?.organization.name ?? '',
        })}
        description={t(AUTH_KEYS.organizationPicker.declineDescription)}
        confirmLabel={t(AUTH_KEYS.organizationPicker.decline)}
        destructive
        testIds={{
          dialog: 'organization-picker-decline-dialog',
          cancel: 'organization-picker-decline-cancel',
          accept: 'organization-picker-decline-confirm',
        }}
        onConfirm={async () => {
          if (declining) await decline(declining);
        }}
      />
    </section>
  );
}
