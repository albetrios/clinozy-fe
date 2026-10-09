import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { ClinicRoleKey } from '@/shared/api/clinic/access-contracts.ts';
import type { BranchOption } from '@/shared/api/clinic/branches-api.ts';
import { type Weekday, WEEKDAY_VALUES } from '@/shared/api/clinic/clinic-schema.ts';
import type { TeamMember } from '@/shared/api/clinic/users-contracts.ts';
import { isInvitationExpired } from '@/shared/api/organization-contracts.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInfo,
  DrawerInput,
  DrawerPhoneInput,
  DrawerStepBody,
  DrawerStepper,
  DrawerSwatches,
  DrawerToggle,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { nextTimeSlot, TimePicker } from '@/shared/components/Picker/TimePicker/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import type { HoursFormat } from '../../shared/hooks/useHoursFormat/index.ts';
import { USERS_KEYS, USERS_NS } from '../../users.constants.ts';
import type { TeamPill } from '../TeamCells/index.ts';
import {
  COMMISSION_QUICK,
  USER_FORM_LIMITS,
  USER_TONES,
  type UserFormValues,
} from './user-form.ts';

const K = USERS_KEYS.drawer;

/** What both steps' fields read. */
interface UserFieldsProps {
  form: UseFormReturn<UserFormValues>;
  /** The form's values as they stand (`useWatch`). */
  values: UserFormValues;
  /** Unique per drawer: the controls' DOM ids derive from it. */
  idPrefix: string;
  /** The drawer's root test id: the controls' derive from it (`user-drawer-name`). */
  testId: string;
  readOnly: boolean;
}

/**
 * Step 1, "Profile, roles & branches" (`users.md:105–112`): Profile — Name*,
 * Mobile, Email* (read-only once the invitation is accepted: it is the sign-in
 * id), Colour; Roles & branches — Roles* (pick order: the first is the main
 * role), Gets access to (read-only), Branches (only with two or more open).
 */
export function UserProfileFields({
  form,
  values,
  idPrefix,
  testId,
  readOnly,
  emailLocked,
  initials,
  roleOptions,
  access,
  branches,
  multiBranch,
}: UserFieldsProps & {
  /** The email is the sign-in id of a member who has joined. */
  emailLocked: boolean;
  /** The person's initials, on the picked swatch ("✓" before a name). */
  initials: string;
  /** Every role on offer, in its tone. */
  roleOptions: readonly TeamPill[];
  /** "Gets access to". */
  access: string;
  branches: readonly BranchOption[];
  multiBranch: boolean;
}) {
  const { t } = useTranslation(USERS_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const name = field('name');
  const mobile = field('phone');
  const email = field('email');
  const roles = field('roleKeys');

  return (
    <DrawerStepBody readOnly={readOnly}>
      <DrawerFieldGrid title={t(K.groups.profile)}>
        <DrawerField
          span="half"
          label={t(K.fields.name)}
          htmlFor={name.id}
          required
          error={name.error}
        >
          <DrawerInput
            {...name.control}
            {...form.register('name')}
            aria-required="true"
            maxLength={USER_FORM_LIMITS.name}
            placeholder={t(K.placeholders.name)}
            autoComplete="off"
            data-testid={`${testId}-name`}
          />
        </DrawerField>
        <DrawerField
          span="half"
          label={t(K.fields.mobile)}
          htmlFor={mobile.id}
          hint={t(K.hints.mobile)}
          error={mobile.error}
        >
          <Controller
            control={form.control}
            name="phone"
            render={({ field: control }) => (
              <DrawerPhoneInput
                {...mobile.control}
                value={control.value}
                onChange={control.onChange}
                onBlur={control.onBlur}
                data-testid={`${testId}-mobile`}
              />
            )}
          />
        </DrawerField>
        <DrawerField
          span="half"
          label={t(K.fields.email)}
          htmlFor={email.id}
          required
          error={email.error}
        >
          <DrawerInput
            {...email.control}
            {...form.register('email')}
            type="email"
            aria-required="true"
            readOnly={emailLocked}
            maxLength={USER_FORM_LIMITS.email}
            placeholder={t(K.placeholders.email)}
            autoComplete="off"
            data-testid={`${testId}-email`}
          />
        </DrawerField>
        <DrawerField label={t(K.fields.colour)} hint={t(K.hints.colour)}>
          <DrawerSwatches
            label={t(K.fields.colour)}
            tones={USER_TONES}
            value={values.tone}
            onChange={(tone) => form.setValue('tone', tone, { shouldDirty: true })}
            mark={initials}
            testId={`${testId}-colour`}
          />
        </DrawerField>
      </DrawerFieldGrid>

      <DrawerFieldGrid title={t(K.groups.rolesBranches)}>
        <DrawerField
          label={t(K.fields.roles)}
          hint={t(K.hints.roles)}
          required
          error={roles.error}
        >
          <DrawerChips<ClinicRoleKey>
            multiple
            ordered
            label={t(K.fields.roles)}
            options={roleOptions.map((role) => ({
              value: role.id,
              label: role.label,
              tone: role.tone,
            }))}
            value={values.roleKeys}
            onChange={(keys) => {
              form.setValue('roleKeys', keys, { shouldDirty: true });
              form.clearErrors('roleKeys');
            }}
            testId={`${testId}-roles`}
          />
        </DrawerField>
        <DrawerField label={t(K.fields.access)}>
          <DrawerInfo testId={`${testId}-access`}>{access}</DrawerInfo>
        </DrawerField>
        {multiBranch ? (
          <DrawerField label={t(K.fields.branches)} hint={t(K.hints.branches)}>
            <DrawerChips
              multiple
              label={t(K.fields.branches)}
              options={branches.map((branch) => ({
                value: branch.id,
                label: branch.name,
                tone: branch.tone,
              }))}
              value={values.branchIds}
              onChange={(ids) => form.setValue('branchIds', ids, { shouldDirty: true })}
              testId={`${testId}-branches`}
            />
          </DrawerField>
        ) : null}
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/**
 * The invited member's Status (`users.md:117`; D17): "Invitation expires 10
 * Oct" / "Invitation expired" read-only, and "Resend invitation" while the
 * link is live — the Settings members copy, relocated.
 */
function InvitationStatus({
  invitation,
  canResend,
  resending,
  onResend,
  testId,
}: {
  invitation: { id: string; expiresAt: string };
  canResend: boolean;
  resending: boolean;
  onResend: () => void;
  testId: string;
}) {
  const { t } = useTranslation(USERS_NS);
  const { formatDate } = useLocaleFormat();
  const expired = isInvitationExpired(invitation);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span
        data-testid={`${testId}-invitation`}
        className={
          expired ? 'text-detail text-destructive' : 'text-detail text-muted-foreground'
        }
      >
        {expired
          ? t(USERS_KEYS.status.expired)
          : t(USERS_KEYS.status.expires, {
              date: formatDate(invitation.expiresAt, { day: 'numeric', month: 'short' }),
            })}
      </span>
      {canResend && !expired ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={resending}
          onClick={onResend}
          data-testid={`${testId}-resend`}
          className="h-7 rounded-lg px-2.5 text-xs"
        >
          {t(K.resend)}
        </Button>
      ) : null}
    </span>
  );
}

/**
 * Step 2, "Working hours & pay" (`users.md:113–117`): Working hours — Days
 * (Mon–Sun; Appointments only offer these days), From and To (06:00–23:30
 * every 30 minutes; To lists only times after From, §7.3); Pay — Commission
 * (a stepper "% of billed" with 0% · 5% · 10% · 15%) and Status — or, for an
 * invited member, the invitation's expiry and "Resend invitation".
 */
export function UserHoursFields({
  form,
  values,
  idPrefix,
  testId,
  readOnly,
  format,
  member,
  statusLocked,
  canResend,
  resending,
  onResend,
}: UserFieldsProps & {
  format: HoursFormat;
  /** The member being edited; null for a new user. */
  member: TeamMember | null;
  /** The owner's or your own status can't be flipped here. */
  statusLocked: boolean;
  canResend: boolean;
  resending: boolean;
  onResend: () => void;
}) {
  const { t } = useTranslation(USERS_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const from = field('startsAt');
  const to = field('endsAt');
  const commission = field('commissionPct');
  const invitation = member?.status === 'invited' ? member.invitation : null;

  return (
    <DrawerStepBody readOnly={readOnly}>
      <DrawerFieldGrid title={t(K.groups.hours)}>
        <DrawerField label={t(K.fields.days)} hint={t(K.hints.days)}>
          <DrawerChips<Weekday>
            multiple
            label={t(K.fields.days)}
            options={WEEKDAY_VALUES.map((day) => ({
              value: day,
              label: format.weekday(day),
            }))}
            value={values.workingDays}
            onChange={(days) => form.setValue('workingDays', days, { shouldDirty: true })}
            testId={`${testId}-days`}
          />
        </DrawerField>
        <DrawerField
          span="half"
          label={t(K.fields.from)}
          htmlFor={from.id}
          error={from.error}
        >
          <Controller
            control={form.control}
            name="startsAt"
            render={({ field: control }) => (
              <TimePicker
                {...from.control}
                value={control.value}
                onChange={(time) => {
                  control.onChange(time);
                  // To lists only later times: a From at or past it moves To on.
                  if (form.getValues('endsAt') <= time) {
                    form.setValue('endsAt', nextTimeSlot(time), { shouldDirty: true });
                  }
                }}
                label={t(K.fields.from)}
                placeholder={t(K.placeholders.time)}
                disabled={readOnly}
                testId={`${testId}-from`}
              />
            )}
          />
        </DrawerField>
        <DrawerField span="half" label={t(K.fields.to)} htmlFor={to.id} error={to.error}>
          <Controller
            control={form.control}
            name="endsAt"
            render={({ field: control }) => (
              <TimePicker
                {...to.control}
                value={control.value}
                onChange={control.onChange}
                label={t(K.fields.to)}
                placeholder={t(K.placeholders.time)}
                from={nextTimeSlot(values.startsAt)}
                disabled={readOnly}
                testId={`${testId}-to`}
              />
            )}
          />
        </DrawerField>
      </DrawerFieldGrid>

      <DrawerFieldGrid title={t(K.groups.pay)}>
        <DrawerField
          span="third"
          label={t(K.fields.commission)}
          htmlFor={commission.id}
          error={commission.error}
        >
          <Controller
            control={form.control}
            name="commissionPct"
            render={({ field: control }) => (
              <DrawerStepper
                {...commission.control}
                value={control.value}
                onValueChange={control.onChange}
                onBlur={control.onBlur}
                max={100}
                suffix={t(K.commissionSuffix)}
                quick={COMMISSION_QUICK.map((quick) => ({
                  label: t(K.commissionQuick, { value: quick }),
                  value: quick,
                }))}
                label={t(K.fields.commission)}
                disabled={readOnly}
                testId={`${testId}-commission`}
              />
            )}
          />
        </DrawerField>
        <DrawerField span="half" label={t(K.fields.status)}>
          {invitation ? (
            <InvitationStatus
              invitation={invitation}
              canResend={canResend}
              resending={resending}
              onResend={onResend}
              testId={testId}
            />
          ) : (
            <DrawerToggle
              aria-label={t(K.fields.status)}
              checked={values.active}
              onCheckedChange={(active) =>
                form.setValue('active', active, { shouldDirty: true })
              }
              onLabel={t(K.statusOn)}
              offLabel={t(K.statusOff)}
              disabled={statusLocked}
              data-testid={`${testId}-status`}
            />
          )}
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}
