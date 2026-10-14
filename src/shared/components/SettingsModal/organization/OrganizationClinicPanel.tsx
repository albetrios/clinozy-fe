import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Controller, useForm, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { APP_MODULES } from '@/core/config/app-modules.ts';
import { isModuleEnabled } from '@/core/security/gates/require-module.ts';
import { OFFERING_SPECIALTY_VALUES } from '@/shared/api/app/app-schema.ts';
import {
  CLINIC_SETTINGS_DEFAULTS,
  CLINIC_SETTINGS_LIMITS,
  type ClinicProfile,
  type ClinicSettings,
} from '@/shared/api/app/clinic-api.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerStepper,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import { QueryBoundary } from '@/shared/components/QueryBoundary/index.ts';
import { SettingsCard } from '@/shared/components/SettingsCard/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { useRegisterSettingsDirty } from '@/shared/components/SettingsModal/settings-dirty.tsx';
import { settingsHash } from '@/shared/components/SettingsModal/settings-hash-grammar.ts';
import { SettingsSectionHeader } from '@/shared/components/SettingsModal/SettingsPanelShell.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import { notifyError } from '@/shared/errors/errorHandler.ts';
import { mapValidationErrors } from '@/shared/errors/map-validation-errors.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useCan } from '@/shared/hooks/useCan/index.ts';
import {
  useClinicProfile,
  useClinicSettings,
  useUpdateClinicProfile,
  useUpdateClinicSettings,
} from '@/shared/hooks/useClinicProfile/index.ts';
import { resetFormInPlace } from '@/shared/hooks/useEditingRecord/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import {
  useChangeOnboardingSetup,
  useOnboardingSetup,
  useSetupAccess,
} from '@/shared/hooks/useOnboardingSetup/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  clinicProfileChange,
  clinicProfileSchema,
  type ClinicProfileValues,
  clinicProfileValues,
  clinicSettingsChange,
  clinicSettingsSchema,
  type ClinicSettingsValues,
  clinicSettingsValues,
  clinicTimeZones,
  curatedTimeZoneName,
  hasClinicChange,
} from './clinic-settings-form.ts';
import { UsersRoomLinkCard } from './UsersRoomLink.tsx';

const K = SETTINGS_KEYS.panels.clinic;

/** The prefix of every field id and test id in the panel. */
const ID_PREFIX = 'org-clinic';

/**
 * Settings › Clinic (feat-clinic-setup KICKOFF §6.6; BRIEF.md:123–133) — the clinic's deeper
 * setup, every value with its default: the specialties and timezone (`PATCH
 * /tenancy/organization`), the booking-reminder hour, lead hold and retarget days (`PATCH
 * /tenancy/organization/settings`), a link to Users › Branches for hours, holidays, rooms,
 * machines, GST and review links, a link to General for the logo, and — while the clinic's
 * setup guide is hidden — "Show the setup guide again". TEAM organizations only; viewed with
 * `organization:read`, saved with `organization:update` (read-only otherwise). No cash-drawer
 * float (D17).
 */
export function OrganizationClinicPanel() {
  const { t } = useTranslation(SETTINGS_NS);
  // Both PATCH routes enforce `organization:update` on clinozy-be (RC-21, RC-23).
  const canManage = useCan({
    permission: 'organization:update',
    teamOrganizationOnly: true,
  });
  const profileQuery = useClinicProfile();
  const settingsQuery = useClinicSettings();

  return (
    <div className="flex flex-col gap-4" data-testid="settings-section-org-clinic">
      <SettingsSectionHeader section="clinic" />
      {canManage ? null : (
        <p
          className="text-muted-foreground text-body"
          data-testid={`${ID_PREFIX}-read-only`}
        >
          {t(K.readOnly)}
        </p>
      )}
      <QueryBoundary
        query={profileQuery}
        errorMessage={t(K.loadFailed)}
        label={t(K.profileTitle)}
      >
        {(profile) => <ClinicProfileCard profile={profile} canManage={canManage} />}
      </QueryBoundary>
      <QueryBoundary
        query={settingsQuery}
        errorMessage={t(K.loadFailed)}
        label={t(K.operationsTitle)}
      >
        {(settings) => <ClinicOperationsCard settings={settings} canManage={canManage} />}
      </QueryBoundary>
      <BranchesLink />
      <LogoLink />
      <SetupGuideAgain />
    </div>
  );
}

/** The card's Save, for a member who may save — disabled until something changed. */
function SaveRow({
  dirty,
  pending,
  testId,
}: {
  dirty: boolean;
  pending: boolean;
  testId: string;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  return (
    <div className="flex justify-end">
      <Button
        type="submit"
        size="sm"
        disabled={!dirty}
        isLoading={pending}
        data-testid={testId}
      >
        {t(K.save)}
      </Button>
    </div>
  );
}

/** The clinic's specialties (pick-any, at least one, the first the main one) and timezone. */
function ClinicProfileCard({
  profile,
  canManage,
}: {
  profile: ClinicProfile;
  canManage: boolean;
}) {
  const { t } = useTranslation([SETTINGS_NS, APP_NS]);
  const [saved, setSaved] = useState(() => clinicProfileValues(profile));
  const schema = useMemo(
    () =>
      clinicProfileSchema({
        specialtiesRequired: t(K.specialtiesRequired),
        timezoneRequired: t(K.timezoneRequired),
      }),
    [t],
  );
  const form = useForm<ClinicProfileValues>({
    resolver: zodResolver(schema),
    defaultValues: saved,
  });
  const { isDirty } = useFormState({ control: form.control });
  useRegisterSettingsDirty(`${ID_PREFIX}-profile`, isDirty);
  const update = useUpdateClinicProfile({
    notifyOnError: false,
    successMessage: t(K.saved),
  });
  const field = useDrawerFieldIds(form, ID_PREFIX);
  const specialties = field('specialties');
  const timezone = field('timezone');

  const specialtyOptions = OFFERING_SPECIALTY_VALUES.map((specialty) => ({
    value: specialty,
    label: t(APP_KEYS.offerings.specialties[specialty], { ns: APP_NS }),
  }));
  const zoneOptions = useMemo(
    () =>
      clinicTimeZones(profile.timezone).map((zone) => {
        const curated = curatedTimeZoneName(zone);
        return {
          key: zone,
          label: zone.replaceAll('_', ' '),
          keywords: curated
            ? [zone.toLowerCase(), curated.toLowerCase()]
            : [zone.toLowerCase()],
        };
      }),
    [profile.timezone],
  );

  const submit = form.handleSubmit((values) => {
    const change = clinicProfileChange(saved, values);
    if (!hasClinicChange(change)) return;
    update.mutate(change, {
      onSuccess: (result) => {
        const next = clinicProfileValues(result);
        setSaved(next);
        resetFormInPlace(form, next);
      },
      onError: (error) => {
        if (!mapValidationErrors(error, form.setError)) notifyError(error);
      },
    });
  });

  return (
    <SettingsCard title={t(K.profileTitle)} description={t(K.profileDescription)}>
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-(--form-gap)"
        data-testid={`${ID_PREFIX}-profile-form`}
      >
        <DrawerField
          label={t(K.specialtiesLabel)}
          hint={t(K.specialtiesHint)}
          required
          error={specialties.error}
        >
          <Controller
            control={form.control}
            name="specialties"
            render={({ field: control }) => (
              <DrawerChips
                multiple
                // Pick order: the first stays the main specialty, a new pick goes last.
                ordered
                label={t(K.specialtiesLabel)}
                options={specialtyOptions}
                value={control.value}
                onChange={control.onChange}
                disabled={!canManage}
                testId={`${ID_PREFIX}-specialties`}
              />
            )}
          />
        </DrawerField>
        <div className="grid gap-(--form-gap) sm:grid-cols-2">
          <DrawerField
            label={t(K.timezoneLabel)}
            htmlFor={timezone.id}
            required
            error={timezone.error}
          >
            <Controller
              control={form.control}
              name="timezone"
              render={({ field: control }) => (
                <Picker
                  id={timezone.id}
                  label={t(K.timezoneLabel)}
                  value={control.value}
                  options={zoneOptions}
                  plain
                  invalid={timezone.error !== undefined}
                  aria-describedby={timezone.control['aria-describedby']}
                  disabled={!canManage}
                  onChange={(key) => {
                    if (key) control.onChange(key);
                  }}
                  testId={`${ID_PREFIX}-timezone`}
                  className="w-full"
                />
              )}
            />
          </DrawerField>
        </div>
        {canManage ? (
          <SaveRow
            dirty={isDirty}
            pending={update.isPending}
            testId={`${ID_PREFIX}-profile-save`}
          />
        ) : null}
      </form>
    </SettingsCard>
  );
}

/** A field's help line under its control, and the ids that tie it and the error to the control. */
function describedBy(id: string, errorId: string | undefined): string {
  return errorId ? `${id}-help ${errorId}` : `${id}-help`;
}

/** The help line under an operating value. */
function FieldHelp({ id, children }: { id: string; children: string }) {
  return (
    <p
      id={`${id}-help`}
      className="text-muted-foreground text-xs leading-[1.45] text-pretty"
    >
      {children}
    </p>
  );
}

/** The booking-reminder hour, the lead hold and the retarget days — each with its default. */
function ClinicOperationsCard({
  settings,
  canManage,
}: {
  settings: ClinicSettings;
  canManage: boolean;
}) {
  const { t } = useTranslation(SETTINGS_NS);
  const clock = useAppClock();
  const { formatNumber } = useLocaleFormat();
  const [saved, setSaved] = useState(() => clinicSettingsValues(settings));
  const schema = useMemo(
    () => clinicSettingsSchema((limits) => t(K.rangeError, limits)),
    [t],
  );
  const form = useForm<ClinicSettingsValues>({
    resolver: zodResolver(schema),
    defaultValues: saved,
  });
  const { isDirty } = useFormState({ control: form.control });
  useRegisterSettingsDirty(`${ID_PREFIX}-operations`, isDirty);
  const update = useUpdateClinicSettings({
    notifyOnError: false,
    successMessage: t(K.saved),
  });
  const field = useDrawerFieldIds(form, ID_PREFIX);
  const reminderHour = field('reminderHour');
  const leadHoldDays = field('leadHoldDays');
  const retargetAfterDays = field('retargetAfterDays');

  /** "4:00 PM" / "16:00" — the clinic-local hour in the viewer's clock format. */
  const hourLabel = (hour: number) =>
    clock.wallTime(clock.today, `${String(hour).padStart(2, '0')}:00`);
  const hourOptions = Array.from(
    { length: CLINIC_SETTINGS_LIMITS.reminderHour.max + 1 },
    (_, hour) => ({ key: String(hour), label: hourLabel(hour) }),
  );
  const defaultHint = (value: string) => t(K.defaultHint, { value });

  const submit = form.handleSubmit((values) => {
    const change = clinicSettingsChange(saved, values);
    if (!hasClinicChange(change)) return;
    update.mutate(change, {
      onSuccess: (result) => {
        const next = clinicSettingsValues(result);
        setSaved(next);
        resetFormInPlace(form, next);
      },
      onError: (error) => {
        if (!mapValidationErrors(error, form.setError)) notifyError(error);
      },
    });
  });

  return (
    <SettingsCard title={t(K.operationsTitle)} description={t(K.operationsDescription)}>
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-(--form-gap)"
        data-testid={`${ID_PREFIX}-operations-form`}
      >
        <div className="grid gap-(--form-gap) sm:grid-cols-3">
          <DrawerField
            label={t(K.reminderHourLabel)}
            hint={defaultHint(hourLabel(CLINIC_SETTINGS_DEFAULTS.reminderHour))}
            htmlFor={reminderHour.id}
            error={reminderHour.error}
          >
            <Controller
              control={form.control}
              name="reminderHour"
              render={({ field: control }) => (
                <Picker
                  id={reminderHour.id}
                  label={t(K.reminderHourLabel)}
                  value={String(control.value)}
                  options={hourOptions}
                  plain
                  searchable={false}
                  invalid={reminderHour.error !== undefined}
                  aria-describedby={describedBy(
                    reminderHour.id,
                    reminderHour.control['aria-describedby'],
                  )}
                  disabled={!canManage}
                  onChange={(key) => {
                    if (key !== null) control.onChange(Number(key));
                  }}
                  testId={`${ID_PREFIX}-reminder-hour`}
                  className="w-full"
                />
              )}
            />
            <FieldHelp id={reminderHour.id}>{t(K.reminderHourHelp)}</FieldHelp>
          </DrawerField>
          <DrawerField
            label={t(K.leadHoldDaysLabel)}
            hint={defaultHint(formatNumber(CLINIC_SETTINGS_DEFAULTS.leadHoldDays))}
            htmlFor={leadHoldDays.id}
            error={leadHoldDays.error}
          >
            <Controller
              control={form.control}
              name="leadHoldDays"
              render={({ field: control }) => (
                <DrawerStepper
                  {...leadHoldDays.control}
                  aria-describedby={describedBy(
                    leadHoldDays.id,
                    leadHoldDays.control['aria-describedby'],
                  )}
                  label={t(K.leadHoldDaysLabel)}
                  value={control.value}
                  onValueChange={control.onChange}
                  onBlur={control.onBlur}
                  min={CLINIC_SETTINGS_LIMITS.leadHoldDays.min}
                  max={CLINIC_SETTINGS_LIMITS.leadHoldDays.max}
                  suffix={t(K.daysUnit)}
                  disabled={!canManage}
                  testId={`${ID_PREFIX}-lead-hold-days`}
                />
              )}
            />
            <FieldHelp id={leadHoldDays.id}>{t(K.leadHoldDaysHelp)}</FieldHelp>
          </DrawerField>
          <DrawerField
            label={t(K.retargetAfterDaysLabel)}
            hint={defaultHint(formatNumber(CLINIC_SETTINGS_DEFAULTS.retargetAfterDays))}
            htmlFor={retargetAfterDays.id}
            error={retargetAfterDays.error}
          >
            <Controller
              control={form.control}
              name="retargetAfterDays"
              render={({ field: control }) => (
                <DrawerStepper
                  {...retargetAfterDays.control}
                  aria-describedby={describedBy(
                    retargetAfterDays.id,
                    retargetAfterDays.control['aria-describedby'],
                  )}
                  label={t(K.retargetAfterDaysLabel)}
                  value={control.value}
                  onValueChange={control.onChange}
                  onBlur={control.onBlur}
                  min={CLINIC_SETTINGS_LIMITS.retargetAfterDays.min}
                  max={CLINIC_SETTINGS_LIMITS.retargetAfterDays.max}
                  suffix={t(K.daysUnit)}
                  disabled={!canManage}
                  testId={`${ID_PREFIX}-retarget-after-days`}
                />
              )}
            />
            <FieldHelp id={retargetAfterDays.id}>{t(K.retargetAfterDaysHelp)}</FieldHelp>
          </DrawerField>
        </div>
        {canManage ? (
          <SaveRow
            dirty={isDirty}
            pending={update.isPending}
            testId={`${ID_PREFIX}-operations-save`}
          />
        ) : null}
      </form>
    </SettingsCard>
  );
}

/**
 * Hours, holidays, rooms, machines, GST and review links live on each branch: a link to Users ›
 * Branches, shown where the member can open it (the `app-users` module, `branch:read`).
 */
function BranchesLink() {
  const canReadBranches = useCan({ permission: 'branch:read' });
  if (!(canReadBranches && isModuleEnabled(APP_MODULES.users))) return null;
  return <UsersRoomLinkCard target="branches" />;
}

/**
 * The clinic's logo lives in Settings › General: a switch to that section. Replaces the history
 * entry as the nav does, so one Back still closes Settings; unsaved edits here meet the drawer's
 * "Discard changes?" first.
 */
function LogoLink() {
  const { t } = useTranslation(SETTINGS_NS);
  const navigate = useNavigate();
  return (
    <SettingsCard
      title={t(K.logoTitle)}
      description={t(K.logoBody)}
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigate({
              to: '.',
              hash: settingsHash('organization', 'general'),
              search: (previous) => previous,
              replace: true,
            });
          }}
          data-testid={`${ID_PREFIX}-open-general`}
        >
          {t(K.logoOpen)}
        </Button>
      }
    />
  );
}

/**
 * "Show the setup guide again" — only while the clinic's setup guide is hidden
 * (`guideHiddenAt`), for a member who may manage the setup (D19): it clears the hidden time, and
 * the avatar ring and "Finish setup" come back.
 */
function SetupGuideAgain() {
  const { t } = useTranslation(SETTINGS_NS);
  const { canManageSetup } = useSetupAccess();
  const setup = useOnboardingSetup();
  const change = useChangeOnboardingSetup();
  const hiddenAt = canManageSetup ? (setup.data?.guideHiddenAt ?? null) : null;
  if (hiddenAt === null) return null;
  return (
    <SettingsCard
      title={t(K.guideTitle)}
      description={t(K.guideBody)}
      data-testid={`${ID_PREFIX}-guide`}
      action={
        <Button
          size="sm"
          variant="outline"
          isLoading={change.isPending}
          onClick={() =>
            change.mutate(
              { guideHidden: false },
              { onSuccess: () => notify.success(t(K.guideShown)) },
            )
          }
          data-testid={`${ID_PREFIX}-show-guide`}
        >
          {t(K.guideShow)}
        </Button>
      }
    />
  );
}
