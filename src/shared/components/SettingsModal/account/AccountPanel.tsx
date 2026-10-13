import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { copyText } from '@/lib/sensitive-clipboard.ts';
import { authApi } from '@/shared/api/auth-api.ts';
import { forceLogout } from '@/shared/auth/service.ts';
import { getAccessToken } from '@/shared/auth/token.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { SectionHeader } from '@/shared/components/SettingsModal/SettingsPanelShell.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import { mapFrontendError } from '@/shared/errors/map-frontend-error.ts';
import { Copy, ShieldCheck, Trash, TriangleAlert } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

import { AccountPrivacyCard } from './AccountPrivacyCard/index.ts';

/**
 * One fact about the account: the label muted at the start, the value at the
 * end, a table row's `muted` hairline between rows.
 */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b-muted flex min-h-10 items-center justify-between gap-4 border-b py-1.5 last:border-b-0">
      <dt className="text-muted-foreground text-body">{label}</dt>
      <dd className="text-body flex min-w-0 justify-end font-medium">{children}</dd>
    </div>
  );
}

/**
 * Account section — read-only account metadata plus a destructive "danger
 * zone" gated behind a confirm dialog.
 *
 * **Delete** is wired to clinozy-be `DELETE /users/me`, then tears down the local
 * session. (A "Deactivate" button was removed: clinozy-be has no deactivate
 * endpoint, so it only ever fired a no-op success toast — delete is the real,
 * working destructive action.)
 */
export function AccountPanel() {
  const { t: tCommon } = useTranslation(LOCALE_NS);
  const { t } = useTranslation(SETTINGS_NS);
  const accountPanels = SETTINGS_KEYS.panels.account;
  const user = useAuthStore((s) => s.user);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const userId = user?.id ?? '—';
  const email = user?.email ?? '—';
  const role = user?.role ?? 'user';

  const copyId = async () => {
    if (await copyText(userId)) {
      notify.success(i18n.t(ERRORS_KEYS.frontend.account.copySuccess, { ns: ERRORS_NS }));
    } else {
      notify.error(i18n.t(ERRORS_KEYS.frontend.account.copyFailed, { ns: ERRORS_NS }));
    }
  };

  const deleteAccount = useMutation({
    mutationFn: async () => {
      const token = getAccessToken();
      if (!token) throw new Error('Not authenticated');
      await authApi.deleteAccount(token);
    },
    onSuccess: () => {
      setConfirmDelete(false);
      notify.success(
        i18n.t(ERRORS_KEYS.frontend.account.accountDeletionPending, { ns: ERRORS_NS }),
      );
      // The account (and its session) no longer exists — tear down the local
      // session and route to /login. `logout` reason keeps it non-forced.
      forceLogout({ reason: 'logout' });
    },
    onError: (error) => {
      notify.error(mapFrontendError(error));
    },
  });

  return (
    <div className="flex flex-col gap-4" data-testid="settings-section-account">
      <SectionHeader
        title={t(accountPanels.title)}
        description={t(accountPanels.description)}
      />

      <SettingsCard
        title={t(accountPanels.infoTitle)}
        description={t(accountPanels.infoDescription)}
      >
        <dl className="flex flex-col">
          <InfoRow label={t(accountPanels.accountIdLabel)}>
            <span className="flex min-w-0 items-center gap-1.5">
              {/* An id is data: it reads left to right on any page (the mono
                  kbd look of the design's ids, `preset.md:181`). */}
              <code
                dir="ltr"
                className="bg-muted text-foreground-soft truncate rounded-md px-1.5 py-0.5 font-mono text-xs"
              >
                {userId}
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={tCommon(LOCALE_KEYS.copyAccountId)}
                onClick={() => void copyId()}
                data-testid="account-copy-id"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </span>
          </InfoRow>
          <InfoRow label={t(accountPanels.emailLabel)}>
            <span dir="ltr" className="truncate">
              {email}
            </span>
          </InfoRow>
          <InfoRow label={t(accountPanels.roleLabel)}>
            <TonePill tone="neutral" size="sm" className="capitalize">
              {role}
            </TonePill>
          </InfoRow>
          <InfoRow label={t(accountPanels.emailVerifiedLabel)}>
            <TonePill tone="sage" size="sm" icon={<ShieldCheck />}>
              {t(accountPanels.verified)}
            </TonePill>
          </InfoRow>
        </dl>
      </SettingsCard>

      <AccountPrivacyCard />

      <SettingsCard
        variant="danger"
        title={
          <>
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            {t(accountPanels.dangerZone)}
          </>
        }
        description={t(accountPanels.dangerZoneDescription)}
        data-testid="danger-zone"
      >
        <div className="border-destructive-border flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-body font-medium">{t(accountPanels.deleteHeading)}</p>
            <p className="text-muted-foreground text-xs leading-[1.45]">
              {t(accountPanels.deleteBody)}
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
            data-testid="account-delete"
            className="self-start sm:self-auto"
          >
            <Trash className="size-4" aria-hidden="true" />
            {t(accountPanels.deleteAction)}
          </Button>
        </div>
      </SettingsCard>

      {/* Open until the request resolves — success routes away; a failure stays
          so the user can retry — and it cannot be dismissed meanwhile. */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t(accountPanels.deleteTitle)}
        description={t(accountPanels.deleteDescription)}
        cancelLabel={t(accountPanels.deleteCancel)}
        confirmLabel={t(accountPanels.deleteConfirm)}
        destructive
        onConfirm={() => deleteAccount.mutateAsync()}
        testIds={{ cancel: 'account-delete-cancel', accept: 'account-delete-confirm' }}
      />
    </div>
  );
}
