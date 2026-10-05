import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { queryClient } from '@/core/http/queryClient.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { authApi } from '@/shared/api/auth-api.ts';
import { getAccessToken } from '@/shared/auth/token.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { useRegisterSettingsDirty } from '@/shared/components/SettingsModal/settings-dirty.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import { Input } from '@/shared/components/ui/input.tsx';
import { Label } from '@/shared/components/ui/label.tsx';
import { mapFrontendError } from '@/shared/errors/map-frontend-error.ts';
import { notify } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { meContextQueryKey } from '@/shared/tenancy/me-context.ts';

import { type ProfileInput, profileSchema } from './contracts.ts';

interface ProfileFormProps {
  email: string;
  defaultValues?: Partial<ProfileInput>;
  /** Called whenever any field changes — used to drive the completeness meter. */
  onValuesChange?: (values: ProfileInput) => void;
}

function toDefaults(values?: Partial<ProfileInput>): ProfileInput {
  return {
    name: values?.name ?? '',
    jobTitle: values?.jobTitle ?? '',
  };
}

/**
 * "About you" profile form: name and job title — the fields clinozy-be
 * `PATCH /users/me` persists. Validates with {@link profileSchema}; saving is
 * confirmed via a dialog, then written through {@link authApi.updateProfile}.
 * On success the app shell name (avatar/greeting) updates immediately and
 * `me/context` is refetched so every consumer sees the new name.
 */
export function ProfileForm({ email, defaultValues, onValuesChange }: ProfileFormProps) {
  const { t } = useTranslation(SETTINGS_NS);
  const panels = SETTINGS_KEYS.panels.profile;
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: toDefaults(defaultValues),
  });

  useRegisterSettingsDirty('profile', isDirty && !showConfirm);

  /**
   * react-hook-form reads `defaultValues` on its FIRST render only. When the
   * profile arrives after that, re-seed the fields — but never over an edit in
   * progress: a late store write must fill an untouched form and leave a
   * touched one alone (SET-18, and rule 14).
   */
  const seededRef = useRef(toDefaults(defaultValues));
  // Keyed on the two field VALUES, not the `defaultValues` object: the panel rebuilds that
  // object on every store write, so depending on it would re-seed constantly and fight an
  // edit in progress. Same rationale as the eslint suppression on the dependency array
  // below (SET-18).
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on field values, not the object
  useEffect(() => {
    const next = toDefaults(defaultValues);
    if (
      next.name === seededRef.current.name &&
      next.jobTitle === seededRef.current.jobTitle
    ) {
      return;
    }
    seededRef.current = next;
    if (!isDirty) reset(next);
    // Compare the VALUES, not the object identity: the panel rebuilds this
    // object on every store write.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the two fields, not the object
  }, [defaultValues?.name, defaultValues?.jobTitle, isDirty, reset]);

  useEffect(() => {
    if (!onValuesChange) return undefined;
    // eslint-disable-next-line react-hooks/incompatible-library -- watch() subscription is intentional and cleaned up below
    const subscription = watch((values) => onValuesChange(values as ProfileInput));
    return () => subscription.unsubscribe();
  }, [watch, onValuesChange]);

  const save = useMutation({
    mutationFn: async (values: ProfileInput) => {
      const token = getAccessToken();
      if (!token) throw new Error('Not authenticated');
      await authApi.updateProfile(
        { name: values.name, jobTitle: values.jobTitle },
        token,
      );
      return values;
    },
    onSuccess: async (values) => {
      // Reflect the new name in the app shell (avatar + header) right away, and
      // refetch me/context so every greeting picks it up too.
      const user = useAuthStore.getState().user;
      if (user) {
        useAuthStore.getState().setUser({
          ...user,
          name: values.name,
          jobTitle: values.jobTitle,
        });
      }
      reset(values);
      setShowConfirm(false);
      notify.success(i18n.t(ERRORS_KEYS.frontend.profileUpdated, { ns: ERRORS_NS }));
      await queryClient.invalidateQueries({ queryKey: meContextQueryKey });
    },
    onError: (error) => {
      notify.error(mapFrontendError(error));
    },
  });

  // Re-validated on confirm; a failed save rejects, so the confirm stays open.
  const onConfirmedSubmit = handleSubmit(async (values) => {
    await save.mutateAsync(values);
  });

  return (
    <>
      <form
        className="space-y-5"
        data-testid="profile-form"
        onSubmit={handleSubmit(() => {
          // Validate BEFORE the confirm dialog — an invalid field (e.g. an
          // over-length name) must surface its error here, not leave the confirm
          // open with a "Save changes" that silently fails validation.
          if (isDirty) setShowConfirm(true);
        })}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-name">{t(panels.nameLabel)}</Label>
            <Input
              id="profile-name"
              {...register('name')}
              placeholder={t(SETTINGS_KEYS.panels.profile.namePlaceholder)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'profile-name-error' : undefined}
              data-testid="profile-name"
            />
            {errors.name && (
              <p
                id="profile-name-error"
                className="text-destructive text-xs"
                role="alert"
              >
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-job-title">{t(panels.jobTitleLabel)}</Label>
            <Input
              id="profile-job-title"
              {...register('jobTitle')}
              placeholder={t(SETTINGS_KEYS.panels.profile.jobTitlePlaceholder)}
              data-testid="profile-job-title"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-email">{t(panels.emailLabel)}</Label>
          <Input
            id="profile-email"
            type="email"
            value={email}
            disabled
            readOnly
            aria-describedby="profile-email-desc"
            className="text-muted-foreground"
            data-testid="profile-email"
          />
          <p id="profile-email-desc" className="text-muted-foreground text-xs">
            {t(panels.emailHint)}
          </p>
        </div>

        <Button
          type="submit"
          disabled={save.isPending || !isDirty}
          data-testid="profile-submit"
        >
          {save.isPending ? t(panels.saving) : t(panels.save)}
        </Button>
      </form>

      {/* Open until the save resolves (onSuccess closes it), and not dismissible meanwhile. */}
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title={t(panels.confirmTitle)}
        description={t(panels.confirmDescription)}
        cancelLabel={t(panels.confirmCancel)}
        confirmLabel={t(panels.confirmSave)}
        onConfirm={onConfirmedSubmit}
        testIds={{ cancel: 'profile-confirm-cancel', accept: 'profile-confirm-save' }}
      />
    </>
  );
}
