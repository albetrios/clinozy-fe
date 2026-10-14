import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import {
  UPLOAD_IMAGE_CONTENT_TYPES,
  UPLOAD_MAX_BYTES,
  type UploadImageContentType,
} from '@/shared/api/uploads-api.ts';
import {
  PersonAvatar,
  personInitials,
} from '@/shared/components/Cells/PersonAvatar/index.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { SettingsSectionHeader } from '@/shared/components/SettingsModal/SettingsPanelShell.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  computeProfileCompleteness,
  type ProfileInput,
} from '@/shared/forms/ProfileForm/contracts.ts';
import { ProfileForm } from '@/shared/forms/ProfileForm/index.ts';
import { useMeContext } from '@/shared/hooks/useMeContext/index.ts';
import {
  useRemoveUserAvatar,
  useUploadUserAvatar,
} from '@/shared/hooks/useUserAvatar/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

/**
 * Profile section — name and job title (the fields clinozy-be persists).
 * Reuses {@link ProfileForm} so there's one source of truth.
 */
export function AccountProfilePanel() {
  const { t } = useTranslation(SETTINGS_NS);
  const user = useAuthStore((s) => s.user);
  /**
   * What the store currently says the profile is. Derived, never snapshotted:
   * the session can write a fuller user AFTER this panel mounted (a proactive
   * refresh re-reads me/context), and a `useState` initializer only ever sees
   * the first one — leaving an empty form and a 0% meter for a profile that is
   * demonstrably filled in (SET-18).
   */
  const seeded = useMemo<ProfileInput>(
    () => ({ name: user?.name ?? '', jobTitle: user?.jobTitle ?? '' }),
    [user?.name, user?.jobTitle],
  );
  /** What the user has typed, if anything — it outranks the store. */
  const [edited, setEdited] = useState<ProfileInput | null>(null);
  const values = edited ?? seeded;
  const completeness = useMemo(() => computeProfileCompleteness(values), [values]);

  const panels = SETTINGS_KEYS.panels.profile;

  return (
    <div className="flex flex-col gap-4" data-testid="settings-section-profile">
      <SettingsSectionHeader
        section="profile"
        meta={t(panels.completeness, { percent: completeness })}
      />
      <AvatarCard name={values.name} />
      <SettingsCard>
        <ProfileForm
          email={user?.email ?? ''}
          defaultValues={seeded}
          onValuesChange={setEdited}
        />
      </SettingsCard>
    </div>
  );
}

/**
 * Avatar preview plus upload / remove.
 *
 * @remarks
 * The URL comes from `useMeContext`, never the auth store. clinozy-be returns `avatar_url` as a
 * short-lived **signed** read URL, so a value snapshotted into the store at sign-in would
 * expire mid-session and start rendering a broken image; the query re-signs it on every
 * invalidation and refetch.
 *
 * Type and size are screened here because clinozy-be rejects both — SVG included — and a
 * rejection after the presign round trip costs the user a wait to be told no.
 *
 * @param props - The display name, used for the fallback initial and the image alt text.
 */
function AvatarCard({ name }: { name: string }) {
  const { t } = useTranslation(SETTINGS_NS);
  const profile = SETTINGS_KEYS.panels.profile;
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: meContext } = useMeContext();
  const avatarUrl = meContext?.user.avatarUrl ?? null;
  const uploadAvatar = useUploadUserAvatar();
  const removeAvatar = useRemoveUserAvatar();
  const busy = uploadAvatar.isPending || removeAvatar.isPending;

  function onAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file after a failure
    if (!file) return;
    if (!UPLOAD_IMAGE_CONTENT_TYPES.includes(file.type as UploadImageContentType)) {
      notify.error(
        i18n.t(ERRORS_KEYS.frontend.account.avatarInvalidType, { ns: ERRORS_NS }),
      );
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES.avatar) {
      notify.error(
        i18n.t(ERRORS_KEYS.frontend.account.avatarTooLarge, { ns: ERRORS_NS }),
      );
      return;
    }
    uploadAvatar.mutate(file);
  }

  return (
    <SettingsCard
      title={t(profile.avatarTitle)}
      description={t(profile.avatarDescription)}
    >
      <div className="flex flex-wrap items-center gap-4">
        {/* The shared avatar is decorative; this frame names the picture. */}
        <div // NOSONAR(S6819): frames a photo OR its initials — a native <img> cannot hold the initials
          role="img"
          aria-label={
            name ? t(profile.avatarAlt, { name }) : t(profile.avatarAltFallback)
          }
          className="shrink-0"
          data-testid="user-avatar-preview"
        >
          <PersonAvatar
            initials={personInitials(name) || '?'}
            tone="stone"
            size="profile"
            src={avatarUrl}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={UPLOAD_IMAGE_CONTENT_TYPES.join(',')}
            className="hidden"
            onChange={onAvatarFile}
            data-testid="user-avatar-input"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            isLoading={busy}
            data-testid="user-avatar-upload"
          >
            {busy ? t(profile.uploadingAvatar) : t(profile.uploadAvatar)}
          </Button>
          {avatarUrl ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => removeAvatar.mutate()}
              disabled={busy}
              data-testid="user-avatar-remove"
            >
              {t(profile.removeAvatar)}
            </Button>
          ) : null}
        </div>
      </div>
    </SettingsCard>
  );
}
