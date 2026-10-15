import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { type Weekday, WEEKDAY_VALUES } from '@/shared/api/app/app-schema.ts';
import { BRANCH_LIMITS } from '@/shared/api/app/branches-contracts.ts';
import type { TeamMember } from '@/shared/api/app/users-contracts.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  type DrawerFieldIds,
  DrawerInput,
  DrawerPhoneInput,
  DrawerStepBody,
  DrawerSwatches,
  DrawerToggle,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { nextTimeSlot, TimePicker } from '@/shared/components/Picker/TimePicker/index.ts';
import type { HoursFormat } from '@/shared/hooks/useHoursFormat/index.ts';
import type { RoleDirectory } from '@/shared/hooks/useRoleDirectory/index.ts';

import { BRANCHES_KEYS, BRANCHES_NS } from '../../branches.constants.ts';
import {
  BRANCH_DEFAULT_ROLES,
  type BranchDefaultRole,
} from '../../hooks/useBranchRows/index.ts';
import { BRANCH_TONES, type BranchFormValues, defaultPool } from './branch-form.ts';

const K = BRANCHES_KEYS.drawer;

/** The "Nobody" option's key in a default person's picker. */
const NOBODY = 'nobody';

/** What every step's fields read. */
interface BranchFieldsProps {
  form: UseFormReturn<BranchFormValues>;
  /** The form's values as they stand (`useWatch`). */
  values: BranchFormValues;
  /** Unique per drawer: the controls' DOM ids derive from it. */
  idPrefix: string;
  /** The drawer's root test id: the controls' derive from it (`branch-drawer-name`). */
  testId: string;
  readOnly: boolean;
}

/** A plain text field of the form: its label, limit and placeholder. */
function TextField({
  form,
  field,
  name,
  label,
  placeholder,
  maxLength,
  span,
  stretch,
  required,
  hint,
  inputMode,
  testId,
}: {
  form: UseFormReturn<BranchFormValues>;
  field: DrawerFieldIds;
  name:
    | 'name'
    | 'addressLine1'
    | 'addressLine2'
    | 'area'
    | 'city'
    | 'state'
    | 'email'
    | 'gstNumber'
    | 'reviewLink';
  label: string;
  placeholder: string;
  maxLength: number;
  span: 'full' | 'half' | 'third';
  stretch?: boolean;
  required?: boolean;
  hint?: string;
  inputMode?: 'url';
  testId: string;
}) {
  return (
    <DrawerField
      span={span}
      stretch={stretch}
      label={label}
      htmlFor={field.id}
      hint={hint}
      required={required}
      error={field.error}
    >
      <DrawerInput
        {...field.control}
        {...form.register(name)}
        aria-required={required ? 'true' : undefined}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete="off"
        data-testid={testId}
      />
    </DrawerField>
  );
}

/**
 * Step 1, "Branch & address" (`users.md:179–186`): Branch — Name* (half,
 * alone), Colour, Main branch (read-only: one per clinic, set when it opened),
 * Status (Closed is how a branch goes — there is no delete); Address — Address
 * line 1*, line 2, Area*, City*, PIN code* (digits only, never masked), State.
 */
export function BranchPlaceFields({
  form,
  values,
  idPrefix,
  testId,
  readOnly,
}: BranchFieldsProps) {
  const { t } = useTranslation(BRANCHES_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const pin = field('pin');

  return (
    <DrawerStepBody readOnly={readOnly}>
      <DrawerFieldGrid title={t(K.groups.branch)}>
        <TextField
          form={form}
          field={field('name')}
          name="name"
          label={t(K.fields.name)}
          placeholder={t(K.placeholders.name)}
          maxLength={BRANCH_LIMITS.name}
          span="half"
          stretch={false}
          required
          testId={`${testId}-name`}
        />
        <DrawerField label={t(K.fields.colour)} hint={t(K.hints.colour)}>
          <DrawerSwatches
            label={t(K.fields.colour)}
            tones={BRANCH_TONES}
            value={values.tone}
            onChange={(tone) => form.setValue('tone', tone, { shouldDirty: true })}
            testId={`${testId}-colour`}
          />
        </DrawerField>
        <DrawerField span="half" label={t(K.fields.main)} hint={t(K.hints.main)}>
          <DrawerToggle
            aria-label={t(K.fields.main)}
            checked={values.isMain}
            disabled
            onCheckedChange={() => undefined}
            onLabel={t(K.toggles.mainOn)}
            offLabel={t(K.toggles.mainOff)}
            data-testid={`${testId}-main`}
          />
        </DrawerField>
        <DrawerField span="half" label={t(K.fields.status)}>
          <DrawerToggle
            aria-label={t(K.fields.status)}
            checked={values.active}
            onCheckedChange={(on) => form.setValue('active', on, { shouldDirty: true })}
            onLabel={t(K.toggles.openOn)}
            offLabel={t(K.toggles.openOff)}
            data-testid={`${testId}-status`}
          />
        </DrawerField>
      </DrawerFieldGrid>

      <DrawerFieldGrid title={t(K.groups.address)}>
        <TextField
          form={form}
          field={field('addressLine1')}
          name="addressLine1"
          label={t(K.fields.line1)}
          placeholder={t(K.placeholders.line1)}
          maxLength={BRANCH_LIMITS.address}
          span="full"
          required
          testId={`${testId}-line1`}
        />
        <TextField
          form={form}
          field={field('addressLine2')}
          name="addressLine2"
          label={t(K.fields.line2)}
          placeholder={t(K.placeholders.line2)}
          maxLength={BRANCH_LIMITS.address}
          span="full"
          testId={`${testId}-line2`}
        />
        <TextField
          form={form}
          field={field('area')}
          name="area"
          label={t(K.fields.area)}
          placeholder={t(K.placeholders.area)}
          maxLength={BRANCH_LIMITS.place}
          span="half"
          required
          testId={`${testId}-area`}
        />
        <TextField
          form={form}
          field={field('city')}
          name="city"
          label={t(K.fields.city)}
          placeholder={t(K.placeholders.city)}
          maxLength={BRANCH_LIMITS.place}
          span="half"
          required
          testId={`${testId}-city`}
        />
        <DrawerField
          span="third"
          label={t(K.fields.pin)}
          htmlFor={pin.id}
          required
          error={pin.error}
        >
          <Controller
            control={form.control}
            name="pin"
            render={({ field: control }) => (
              <DrawerInput
                {...pin.control}
                value={control.value}
                onChange={(event) =>
                  control.onChange(
                    event.target.value.replace(/\D/g, '').slice(0, BRANCH_LIMITS.pin),
                  )
                }
                onBlur={control.onBlur}
                inputMode="numeric"
                aria-required="true"
                maxLength={BRANCH_LIMITS.pin}
                placeholder={t(K.placeholders.pin)}
                autoComplete="off"
                data-testid={`${testId}-pin`}
              />
            )}
          />
        </DrawerField>
        <TextField
          form={form}
          field={field('state')}
          name="state"
          label={t(K.fields.state)}
          placeholder={t(K.placeholders.state)}
          maxLength={BRANCH_LIMITS.state}
          span="half"
          testId={`${testId}-state`}
        />
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/**
 * Step 2, "Contact & opening hours" (`users.md:187–192`): Contact — Phone*
 * ("+91", 10 digits), Email*, GSTIN (upper-cased), the Google review link (`https://`; the
 * payment received view's review ask sends it, `feat-payment-celebration`); Opening hours — Days,
 * Opens, Closes (06:00–23:30 every 30 minutes; Closes lists only times after
 * Opens, `S:174`).
 */
export function BranchContactFields({
  form,
  values,
  idPrefix,
  testId,
  readOnly,
  format,
}: BranchFieldsProps & { format: HoursFormat }) {
  const { t } = useTranslation(BRANCHES_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const phone = field('phone');
  const gst = field('gstNumber');
  const opens = field('opensAt');
  const closes = field('closesAt');

  return (
    <DrawerStepBody readOnly={readOnly}>
      <DrawerFieldGrid title={t(K.groups.contact)}>
        <DrawerField
          span="third"
          label={t(K.fields.phone)}
          htmlFor={phone.id}
          hint={t(K.hints.phone)}
          required
          error={phone.error}
        >
          <Controller
            control={form.control}
            name="phone"
            render={({ field: control }) => (
              <DrawerPhoneInput
                {...phone.control}
                value={control.value}
                onChange={control.onChange}
                onBlur={control.onBlur}
                aria-required="true"
                data-testid={`${testId}-phone`}
              />
            )}
          />
        </DrawerField>
        <TextField
          form={form}
          field={field('email')}
          name="email"
          label={t(K.fields.email)}
          placeholder={t(K.placeholders.email)}
          maxLength={BRANCH_LIMITS.email}
          span="half"
          required
          testId={`${testId}-email`}
        />
        <DrawerField
          span="half"
          stretch={false}
          label={t(K.fields.gstin)}
          htmlFor={gst.id}
          error={gst.error}
        >
          <Controller
            control={form.control}
            name="gstNumber"
            render={({ field: control }) => (
              <DrawerInput
                {...gst.control}
                value={control.value}
                onChange={(event) =>
                  control.onChange(
                    event.target.value.toUpperCase().slice(0, BRANCH_LIMITS.gstNumber),
                  )
                }
                onBlur={control.onBlur}
                maxLength={BRANCH_LIMITS.gstNumber}
                placeholder={t(K.placeholders.gstin)}
                autoComplete="off"
                data-testid={`${testId}-gstin`}
              />
            )}
          />
        </DrawerField>
        <TextField
          form={form}
          field={field('reviewLink')}
          name="reviewLink"
          label={t(K.fields.reviewLink)}
          placeholder={t(K.placeholders.reviewLink)}
          hint={t(K.hints.reviewLink)}
          inputMode="url"
          maxLength={BRANCH_LIMITS.reviewLink}
          span="full"
          testId={`${testId}-review-link`}
        />
      </DrawerFieldGrid>

      <DrawerFieldGrid title={t(K.groups.hours)}>
        <DrawerField label={t(K.fields.days)}>
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
          label={t(K.fields.opens)}
          htmlFor={opens.id}
          error={opens.error}
        >
          <Controller
            control={form.control}
            name="opensAt"
            render={({ field: control }) => (
              <TimePicker
                {...opens.control}
                value={control.value}
                onChange={(time) => {
                  control.onChange(time);
                  // Closes lists only later times: an Opens at or past it moves Closes on.
                  if (form.getValues('closesAt') <= time) {
                    form.setValue('closesAt', nextTimeSlot(time), { shouldDirty: true });
                  }
                }}
                label={t(K.fields.opens)}
                placeholder={t(BRANCHES_KEYS.drawer.placeholders.time)}
                disabled={readOnly}
                testId={`${testId}-opens`}
              />
            )}
          />
        </DrawerField>
        <DrawerField
          span="half"
          label={t(K.fields.closes)}
          htmlFor={closes.id}
          error={closes.error}
        >
          <Controller
            control={form.control}
            name="closesAt"
            render={({ field: control }) => (
              <TimePicker
                {...closes.control}
                value={control.value}
                onChange={control.onChange}
                label={t(K.fields.closes)}
                placeholder={t(BRANCHES_KEYS.drawer.placeholders.time)}
                from={nextTimeSlot(values.opensAt)}
                disabled={readOnly}
                testId={`${testId}-closes`}
              />
            )}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/** A person as a picker option: avatar, name ("Riya Shah (you)"), roles joined " + ". */
function personOption(
  member: TeamMember,
  directory: RoleDirectory,
  you: (name: string) => string,
): PickerOption {
  return {
    key: member.membershipId,
    label: member.isSelf ? you(member.name) : member.name,
    sub: directory
      .pills(member.roleIds)
      .map((pill) => pill.label)
      .join(' + '),
    tone: member.tone,
    leading: { kind: 'avatar', initials: member.initials },
  };
}

/**
 * Step 3, "People" (`users.md:193–197`): Team — who works here, the active
 * users with you first — then the four default people, each "Nobody" or a
 * team member holding the role (front desk: Front desk or Counsellor),
 * preselected in forms here. The pharmacist field is one full-width "Nobody"
 * chip while the team has none (H:5212).
 */
export function BranchPeopleFields({
  form,
  values,
  idPrefix,
  testId,
  readOnly,
  people,
  directory,
}: BranchFieldsProps & {
  /** The people who may work here: the active Team, you first. */
  people: readonly TeamMember[];
  directory: RoleDirectory;
}) {
  const { t } = useTranslation(BRANCHES_NS);
  const you = (name: string) => t(K.you, { name });
  const team = people.filter((member) => values.teamIds.includes(member.membershipId));
  const nobody: PickerOption = {
    key: NOBODY,
    label: t(K.nobody),
    tone: 'butter',
    leading: { kind: 'dot' },
  };

  const setDefault = (role: BranchDefaultRole, id: string | null) =>
    form.setValue(`defaults.${role}`, id, { shouldDirty: true });

  return (
    <DrawerStepBody readOnly={readOnly}>
      <DrawerFieldGrid>
        <DrawerField
          span="half"
          label={t(K.fields.team)}
          hint={t(K.hints.team)}
          htmlFor={`${idPrefix}-team`}
        >
          <Picker
            multiple
            id={`${idPrefix}-team`}
            label={t(K.fields.team)}
            placeholder={t(K.placeholders.team)}
            options={people.map((member) => personOption(member, directory, you))}
            value={values.teamIds}
            onChange={(ids) => form.setValue('teamIds', ids, { shouldDirty: true })}
            maxChips={2}
            disabled={readOnly}
            testId={`${testId}-team`}
          />
        </DrawerField>
        {BRANCH_DEFAULT_ROLES.map((role) => {
          const pool = defaultPool(role, team, directory.preset);
          const id = `${idPrefix}-default-${role}`;
          const hint =
            pool.length > 0 ? t(K.hints.preselected) : t(K.hints.addFirst[role]);
          if (role === 'pharmacist' && pool.length === 0) {
            return (
              <DrawerField key={role} span="full" label={t(K.fields[role])} hint={hint}>
                <DrawerChips
                  label={t(K.fields[role])}
                  options={[{ value: NOBODY, label: t(K.nobody) }]}
                  value={NOBODY}
                  onChange={() => setDefault(role, null)}
                  variant="outline"
                  testId={`${testId}-default-${role}`}
                />
              </DrawerField>
            );
          }
          const picked = values.defaults[role];
          const value = pool.some((member) => member.membershipId === picked)
            ? picked
            : NOBODY;
          return (
            <DrawerField
              key={role}
              span="half"
              label={t(K.fields[role])}
              hint={hint}
              htmlFor={id}
            >
              <Picker
                id={id}
                label={t(K.fields[role])}
                options={[
                  nobody,
                  ...pool.map((member) => personOption(member, directory, you)),
                ]}
                value={value}
                onChange={(key) => setDefault(role, !key || key === NOBODY ? null : key)}
                disabled={readOnly}
                testId={`${testId}-default-${role}`}
              />
            </DrawerField>
          );
        })}
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}
