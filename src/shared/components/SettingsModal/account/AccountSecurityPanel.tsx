import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { copySensitiveText } from '@/lib/sensitive-clipboard.ts';
import type { MfaEnrollment } from '@/shared/api/mfa-api.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { DrawerField, DrawerInput } from '@/shared/components/DrawerField/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { PanelSkeleton } from '@/shared/components/PanelSkeleton/index.ts';
import { QrCode } from '@/shared/components/QrCode/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { RecoveryCodesPanel } from '@/shared/components/RecoveryCodesPanel/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { SecurityOverviewCard } from '@/shared/components/SecurityOverviewCard/index.ts';
import {
  SettingsCard,
  SettingsList,
  SettingsListRow,
  settingsRowActionClass,
  SettingsRowTile,
} from '@/shared/components/SettingsCard/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { SettingsSectionHeader } from '@/shared/components/SettingsModal/SettingsPanelShell.tsx';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';
import { useStepUpGuard } from '@/shared/components/StepUpDialog/index.ts';
import { TotpCodeInput } from '@/shared/components/TotpCodeInput/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import {
  useBeginMfaEnrollment,
  useConfirmMfaEnrollment,
  useDisableMfa,
  useMfaStatus,
} from '@/shared/hooks/useMfa/index.ts';
import {
  usePasskeys,
  useRegisterPasskey,
  useRemovePasskey,
} from '@/shared/hooks/usePasskeys/index.ts';
import { Copy, Fingerprint, ShieldCheck, Trash } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

/** The QR, the secret and the code — a light form: the 560px drawer (`_patterns.md:28`). */
const MFA_SETUP_PROFILE = { fieldCount: 2 } as const;

/** One name to type: the light 560px drawer. */
const PASSKEY_ADD_PROFILE = { fieldCount: 1 } as const;

/** The setup drawer's head for its phase: scan and verify, then the recovery codes. */
function mfaSetupCopy(recoveryShown: boolean) {
  const mfa = SETTINGS_KEYS.security.mfa;
  return recoveryShown
    ? { title: mfa.recoveryTitle, sub: mfa.recoveryDescription }
    : { title: mfa.setupTitle, sub: mfa.setupDescription };
}

/**
 * Two-factor card: QR enroll → 6-digit OTP → recovery codes + disable. Setup
 * is a child drawer stacked on Settings (L-65): Back returns to Security, and
 * the recovery codes' own Done closes it.
 */
function MfaCard() {
  const { t } = useTranslation(SETTINGS_NS);
  // The WHOLE query, not just `data`: `?? false` is indistinguishable from a
  // real "2FA is off", so the card used to open claiming Disabled with a Set-up
  // button while the status was still loading — and said the same thing forever
  // when the read failed. A security state has to be known before it is stated.
  const mfaStatus = useMfaStatus();
  const mfaEnabled = mfaStatus.data ?? false;
  const begin = useBeginMfaEnrollment();
  const confirm = useConfirmMfaEnrollment();
  const disable = useDisableMfa();
  const { guard, isGuarding, stepUpDialog } = useStepUpGuard();

  const [setupOpen, setSetupOpen] = useState(false);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const setupCopy = mfaSetupCopy(recoveryCodes !== null);

  function closeSetup() {
    setSetupOpen(false);
    setEnrollment(null);
    setCode('');
    setRecoveryCodes(null);
    setConfirmError(null);
    setSecretCopied(false);
  }

  function handleStartSetup() {
    setCode('');
    setConfirmError(null);
    setRecoveryCodes(null);
    setSecretCopied(false);
    // Enrollment is step-up gated; the bootstrap email-code factor is allowed
    // here (it exists exactly so a passwordless account can enroll its first
    // second factor).
    void guard(
      () =>
        begin.mutateAsync().then((result) => {
          setEnrollment(result);
          setSetupOpen(true);
        }),
      {
        onError: () => notify.error(t(SETTINGS_KEYS.security.mfa.errors.setupFailed)),
      },
    );
  }

  function handleSubmitCode(nextCode = code) {
    if (nextCode.length < 6) return;
    setConfirmError(null);
    confirm
      .mutateAsync(nextCode)
      .then((result) => setRecoveryCodes(result.recoveryCodes))
      .catch(() => setConfirmError(t(SETTINGS_KEYS.security.mfa.errors.invalidCode)));
  }

  async function handleCopySecret() {
    if (!enrollment?.secret) return;
    const ok = await copySensitiveText(enrollment.secret);
    if (ok) {
      setSecretCopied(true);
      window.setTimeout(() => setSecretCopied(false), 2000);
      notify.info(t(SETTINGS_KEYS.security.recoveryCodes.clipboardNotice));
    } else {
      notify.error(t(SETTINGS_KEYS.security.mfa.errors.setupFailed));
    }
  }

  // Only rendered once the status is KNOWN — see mfaStatus above.
  const mfaAction = mfaEnabled ? (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setDisableOpen(true)}
      disabled={isGuarding}
      data-testid="mfa-disable"
    >
      {t(SETTINGS_KEYS.security.mfa.disable)}
    </Button>
  ) : (
    <Button
      size="sm"
      onClick={handleStartSetup}
      disabled={begin.isPending || isGuarding}
      data-testid="mfa-setup"
    >
      <ShieldCheck data-icon="inline-start" />
      {t(SETTINGS_KEYS.security.mfa.setup)}
    </Button>
  );

  return (
    <SettingsCard
      title={t(SETTINGS_KEYS.security.mfa.title)}
      description={t(SETTINGS_KEYS.security.mfa.description)}
      action={
        <>
          {mfaStatus.isSuccess ? (
            <TonePill tone={mfaEnabled ? 'sage' : 'neutral'} dot data-testid="mfa-status">
              {mfaEnabled
                ? t(SETTINGS_KEYS.security.mfa.enabled)
                : t(SETTINGS_KEYS.security.mfa.disabled)}
            </TonePill>
          ) : null}
          {mfaStatus.isPending ? (
            <span data-testid="mfa-status-loading" className="flex">
              <SkeletonBar className="h-6 w-16" />
            </span>
          ) : null}
        </>
      }
    >
      <div>
        {mfaStatus.isPending ? (
          <span data-testid="mfa-loading" className="flex">
            <SkeletonBar shape="field" className="w-32" />
          </span>
        ) : null}
        {mfaStatus.isError ? (
          <div data-testid="mfa-error">
            <RetryError
              message={t(SETTINGS_KEYS.security.loadFailed)}
              onRetry={mfaStatus.refetch}
              isRetrying={mfaStatus.isFetching}
            />
          </div>
        ) : null}
        {mfaStatus.isSuccess ? mfaAction : null}
      </div>

      <RecordDrawer
        open={setupOpen}
        onClose={closeSetup}
        title={t(setupCopy.title)}
        sub={t(setupCopy.sub)}
        content={MFA_SETUP_PROFILE}
        stacked
        saveLabel={t(SETTINGS_KEYS.security.mfa.verifyEnable)}
        onSave={() => handleSubmitCode()}
        saveDisabled={code.length < 6 || confirm.isPending}
        saveTestId="mfa-verify"
        hideFooter={recoveryCodes !== null}
        testId="mfa-setup-dialog"
      >
        {recoveryCodes ? (
          <RecoveryCodesPanel codes={recoveryCodes} onDone={closeSetup} />
        ) : (
          <div className="flex flex-col gap-4">
            <MfaEnrollmentSecret
              enrollment={enrollment}
              secretCopied={secretCopied}
              onCopy={() => void handleCopySecret()}
            />

            <DrawerField
              label={t(SETTINGS_KEYS.security.mfa.codeLabel)}
              htmlFor="mfa-code"
              error={confirmError ?? undefined}
            >
              <TotpCodeInput
                id="mfa-code"
                value={code}
                onChange={setCode}
                onComplete={handleSubmitCode}
                invalid={!!confirmError}
                testId="mfa-code"
                aria-label={t(SETTINGS_KEYS.security.mfa.codeAria)}
              />
            </DrawerField>
          </div>
        )}
      </RecordDrawer>

      <MfaDisableConfirm
        open={disableOpen}
        onOpenChange={setDisableOpen}
        onConfirm={() =>
          // Destructive — needs a STRONG step-up window (TOTP for MFA accounts;
          // the bootstrap email code is never accepted here). RETURNED, so the
          // dialog stays open and busy until the round-trip settles.
          guard(() => disable.mutateAsync(), { allowEmailCode: false })
        }
      />

      {stepUpDialog}
    </SettingsCard>
  );
}

/** QR + copyable secret for the staged enrollment (scan or manual entry). */
function MfaEnrollmentSecret({
  enrollment,
  secretCopied,
  onCopy,
}: {
  enrollment: MfaEnrollment | null;
  secretCopied: boolean;
  onCopy: () => void;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  return (
    <>
      {enrollment?.otpauthUri ? (
        <div className="flex flex-col items-center gap-2">
          <div
            data-slot="card"
            className="bg-card flex size-44 items-center justify-center rounded-xl border p-3"
            data-testid="mfa-qr"
          >
            <QrCode data={enrollment.otpauthUri} />
          </div>
          <p className="text-muted-foreground text-center text-xs">
            {t(SETTINGS_KEYS.security.mfa.scanHint)}
          </p>
        </div>
      ) : null}

      <DrawerField label={t(SETTINGS_KEYS.security.mfa.secretLabel)} htmlFor="mfa-secret">
        <div className="flex gap-2">
          <div
            id="mfa-secret"
            dir="ltr"
            className="bg-canvas text-detail flex min-h-9 flex-1 items-center rounded-lg border px-2.5 py-1.5 font-mono break-all"
            data-testid="mfa-secret"
          >
            {enrollment?.secret}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t(SETTINGS_KEYS.security.mfa.copySecret)}
            onClick={onCopy}
            data-testid="mfa-copy-secret"
            className={settingsRowActionClass()}
          >
            <Copy data-icon="inline-start" />
          </Button>
        </div>
        {secretCopied ? (
          <p className="text-success text-xs">
            {t(SETTINGS_KEYS.security.mfa.copiedSecret)}
          </p>
        ) : null}
      </DrawerField>
    </>
  );
}

/** Disable-2FA confirmation, extracted to keep {@link MfaCard} readable. */
function MfaDisableConfirm({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Awaited by ConfirmDialog — return the promise so it can hold its busy state. */
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(SETTINGS_KEYS.security.mfa.disableTitle)}
      description={t(SETTINGS_KEYS.security.mfa.disableDescription)}
      confirmLabel={t(SETTINGS_KEYS.security.mfa.disableConfirm)}
      destructive
      onConfirm={onConfirm}
    />
  );
}

/** Passkeys card: list + named registration + revoke (FE-32). */
/**
 * One saved credential, and its own removal.
 *
 * The mutation lives HERE, not on the card: `useRemovePasskey().isPending` is
 * one flag per instance, so a card-level instance greyed out every row's button
 * while any one of them was going (SET-24). A per-row instance also gives each
 * row its own single-flight guard, so "leave the other rows enabled" cannot
 * become "the second click is silently joined to the first" (rule 1).
 */
function PasskeyRow({
  passkey,
  guard,
  isSteppingUp,
}: {
  passkey: { id: string; name: string };
  guard: ReturnType<typeof useStepUpGuard>['guard'];
  /** A re-authentication dialog is open — no row may start another. */
  isSteppingUp: boolean;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  const remove = useRemovePasskey();

  return (
    <SettingsListRow data-testid="passkey-row">
      <SettingsRowTile icon={Fingerprint} />
      <span dir="auto" className="text-body min-w-0 flex-1 truncate font-medium">
        {passkey.name}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        className={settingsRowActionClass(true)}
        aria-label={t(SETTINGS_KEYS.security.passkeys.removeAria, { name: passkey.name })}
        onClick={() =>
          // Destructive — STRONG step-up only (never the email code).
          void guard(() => remove.mutateAsync(passkey.id), { allowEmailCode: false })
        }
        isLoading={remove.isPending}
        // Shared only for the ceremony: while a step-up dialog is open no row
        // may start another. A removal that is simply in flight belongs to its
        // own row and leaves the rest of the list alone.
        disabled={isSteppingUp}
        data-testid="passkey-remove"
        data-passkey-id={passkey.id}
      >
        {remove.isPending ? null : <Trash className="size-3.5" />}
      </Button>
    </SettingsListRow>
  );
}

function PasskeysCard() {
  const { t } = useTranslation(SETTINGS_NS);
  // Same reasoning as MfaCard: an empty list is a claim ("you have no
  // passkeys"), not a neutral placeholder for one that failed to load.
  const passkeysQuery = usePasskeys();
  const passkeys = passkeysQuery.data ?? [];
  const register = useRegisterPasskey();
  const { guard, isGuarding, isSteppingUp, stepUpDialog } = useStepUpGuard();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  // The name takes focus on open, as it did when this was a dialog.
  const nameRef = useRef<HTMLInputElement>(null);

  function closeAdd() {
    setAddOpen(false);
    setName('');
  }

  function submitAdd() {
    // Registration is step-up gated; bootstrap email-code is allowed (first factor).
    void guard(() => register.mutateAsync(name.trim() || 'New passkey').then(closeAdd));
  }

  // Only rendered once the list is KNOWN — see passkeysQuery above.
  const passkeysBody =
    passkeys.length === 0 ? (
      <EmptyState
        variant="compact"
        tone="lav"
        icon={<Fingerprint />}
        title={t(SETTINGS_KEYS.security.passkeys.empty)}
        testId="passkeys-empty"
        className="py-4"
      />
    ) : (
      <SettingsList>
        {passkeys.map((passkey) => (
          <PasskeyRow
            key={passkey.id}
            passkey={passkey}
            guard={guard}
            isSteppingUp={isSteppingUp}
          />
        ))}
      </SettingsList>
    );

  return (
    <SettingsCard
      title={t(SETTINGS_KEYS.security.passkeys.title)}
      description={t(SETTINGS_KEYS.security.passkeys.description)}
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAddOpen(true)}
          data-testid="add-passkey"
        >
          <Fingerprint data-icon="inline-start" />
          {t(SETTINGS_KEYS.security.passkeys.add)}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        {passkeysQuery.isPending ? <PanelSkeleton testId="passkeys-loading" /> : null}
        {passkeysQuery.isError ? (
          <div data-testid="passkeys-error">
            <RetryError
              message={t(SETTINGS_KEYS.security.loadFailed)}
              onRetry={passkeysQuery.refetch}
              isRetrying={passkeysQuery.isFetching}
            />
          </div>
        ) : null}
        {passkeysQuery.isSuccess ? passkeysBody : null}
      </div>

      {/* Naming a new passkey: a child drawer stacked on Settings (L-65). */}
      <RecordDrawer
        open={addOpen}
        onClose={closeAdd}
        title={t(SETTINGS_KEYS.security.passkeys.addTitle)}
        sub={t(SETTINGS_KEYS.security.passkeys.addDescription)}
        content={PASSKEY_ADD_PROFILE}
        stacked
        initialFocusRef={nameRef}
        saveLabel={t(SETTINGS_KEYS.security.passkeys.submit)}
        onSave={submitAdd}
        saveDisabled={register.isPending || isGuarding}
        saveTestId="passkey-add-submit"
        testId="passkey-add-dialog"
      >
        <DrawerField
          label={t(SETTINGS_KEYS.security.passkeys.nameLabel)}
          htmlFor="passkey-name"
        >
          <DrawerInput
            ref={nameRef}
            id="passkey-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t(SETTINGS_KEYS.security.passkeys.namePlaceholder)}
            data-testid="passkey-name"
          />
        </DrawerField>
      </RecordDrawer>

      {stepUpDialog}
    </SettingsCard>
  );
}

/**
 * Security section — two-factor authentication (real setup/disable flow, FE-32)
 * and passkeys (list / register / revoke, FE-32). Active sessions live in their
 * own panel (FE-31), so they are no longer duplicated here.
 */
export function AccountSecurityPanel() {
  const { t } = useTranslation(SETTINGS_NS);
  const mfaStatus = useMfaStatus();
  const passkeysQuery = usePasskeys();
  // The score is a claim about the account's posture. Built from `?? false` /
  // `?? []` it reads "1 of 3 protections active" while both reads are still in
  // flight, then jumps — and stays wrong if either read failed. Show it only
  // once both are known; the cards below carry the error and the retry.
  const overviewReady = mfaStatus.isSuccess && passkeysQuery.isSuccess;
  const overviewFailed = mfaStatus.isError || passkeysQuery.isError;

  return (
    <div className="flex flex-col gap-4" data-testid="settings-section-security">
      <SettingsSectionHeader section="security" />

      {overviewReady ? (
        <SecurityOverviewCard
          mfaEnabled={mfaStatus.data}
          passkeyCount={passkeysQuery.data.length}
        />
      ) : null}
      {overviewReady || overviewFailed ? null : (
        <SettingsCard
          data-testid="security-overview-loading"
          aria-busy="true"
          title={t(SETTINGS_KEYS.security.overview.title)}
          description={t(SETTINGS_KEYS.security.overview.description)}
        >
          <div className="flex flex-col gap-2.5 py-1" aria-hidden="true">
            <SkeletonBar index={0} />
            <SkeletonBar index={1} />
            <SkeletonBar index={2} />
          </div>
        </SettingsCard>
      )}

      {/* Two independent credential features in one panel: a throw in the
          passkey list must not take two-factor management with it, and the
          reverse. */}
      <SectionErrorBoundary
        title={t(SETTINGS_KEYS.security.mfa.title)}
        testId="mfa-card-error"
      >
        <MfaCard />
      </SectionErrorBoundary>

      <SectionErrorBoundary
        title={t(SETTINGS_KEYS.security.passkeys.title)}
        testId="passkeys-card-error"
      >
        <PasskeysCard />
      </SectionErrorBoundary>
    </div>
  );
}
