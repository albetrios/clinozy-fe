import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  type Branch,
  OFFER_KIND_VALUES,
  OFFERING_CATEGORY_VALUES,
} from '@/shared/api/clinic/clinic-schema.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { basePrice } from '@/shared/api/clinic/offerings-pricing.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  OFFER_KIND_TONES,
  OFFERING_CATEGORY_TONES,
} from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  type DrawerFieldProps,
  DrawerInfo,
  DrawerInput,
  DrawerNumberInput,
  DrawerStepper,
  DrawerSwatches,
  DrawerTextarea,
  DrawerToggle,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { CATALOGUE_CELLS_KEYS } from '../../../shared/components/CatalogueCells/index.ts';
import { OFFER_DRAWER_KEYS, OFFER_DRAWER_NS } from './offer-drawer.constants.ts';
import type { OfferPreviewBox } from './offer-drawer-view.ts';
import {
  codeOf,
  isCountedKind,
  KIND_START_VALUES,
  OFFER_FORM_LIMITS,
  OFFER_TONES,
  type OfferFormValues,
  PERCENT_QUICK_PICKS,
} from './offer-form.ts';

const F = OFFER_DRAWER_KEYS.fields;

/** The "All branches" chip's value — never a branch id. */
const ALL_BRANCHES = 'all';

/** The date lists' window (`offerings.md:104`): today, 120 days ahead, then 60 back. */
const DATE_WINDOW = { future: 120, past: 60 } as const;

/** What every step's fields read: the form and its live values, the ids' prefix. */
interface OfferFieldsProps {
  form: UseFormReturn<OfferFormValues>;
  /** The form's values as they stand (`useWatch`), for what the fields derive. */
  values: OfferFormValues;
  /** Unique per drawer: the controls' DOM ids derive from it. */
  idPrefix: string;
  /** The drawer's root test id: the controls' derive from it (`offer-drawer-name`). */
  testId: string;
}

/**
 * The value field for the offer's kind (`offerings.md:98`): "Discount" — a
 * stepper in % with quick picks — "Amount off" and "Offer price" in ₹, or
 * "Free sessions", a stepper.
 */
function OfferValueField({
  form,
  values,
  idPrefix,
  testId,
}: OfferFieldsProps & Pick<DrawerFieldProps, 'span' | 'stretch'>) {
  const { t } = useTranslation(OFFER_DRAWER_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const field = useDrawerFieldIds(form, idPrefix)('value');
  const label = t(F.value[values.kind]);
  const counted = isCountedKind(values.kind);
  const percent = values.kind === 'percent';
  return (
    <DrawerField
      span="half"
      stretch={false}
      label={label}
      htmlFor={field.id}
      required
      error={field.error}
    >
      <Controller
        control={form.control}
        name="value"
        render={({ field: control }) =>
          counted ? (
            <DrawerStepper
              {...field.control}
              label={label}
              value={Number.parseInt(control.value, 10) || 0}
              onValueChange={(next) => control.onChange(String(next))}
              max={percent ? OFFER_FORM_LIMITS.percent : OFFER_FORM_LIMITS.extraSessions}
              suffix={percent ? '%' : t(F.sessionsUnit)}
              quick={
                percent
                  ? PERCENT_QUICK_PICKS.map((value) => ({
                      label: t(F.percentQuick, { value }),
                      value,
                    }))
                  : undefined
              }
              testId={`${testId}-value`}
            />
          ) : (
            <DrawerNumberInput
              {...field.control}
              value={control.value}
              onValueChange={control.onChange}
              onBlur={control.onBlur}
              prefix={tDrawer(RECORD_DRAWER_KEYS.currency)}
              placeholder="0"
              maxLength={OFFER_FORM_LIMITS.money}
              data-testid={`${testId}-value`}
            />
          )
        }
      />
    </DrawerField>
  );
}

/**
 * Step 1, "Offer" (`offerings.md:95–99`): Name* · Code (upper-cased, spaces
 * stripped), Type — switching resets the value (10 · 500 · empty · 1, H:5512)
 * — the value, and the eight colours.
 */
export function OfferMainFields(props: OfferFieldsProps) {
  const { form, idPrefix, testId } = props;
  const { t } = useTranslation(OFFER_DRAWER_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const name = field('name');
  const code = field('code');
  return (
    <DrawerFieldGrid>
      <DrawerField
        span="half"
        label={t(F.name)}
        htmlFor={name.id}
        required
        error={name.error}
      >
        <DrawerInput
          {...name.control}
          {...form.register('name')}
          aria-required="true"
          maxLength={OFFER_FORM_LIMITS.name}
          placeholder={t(F.namePlaceholder)}
          autoComplete="off"
          data-testid={`${testId}-name`}
        />
      </DrawerField>
      <DrawerField
        span="half"
        label={t(F.code)}
        htmlFor={code.id}
        hint={t(F.codeHint)}
        error={code.error}
      >
        <Controller
          control={form.control}
          name="code"
          render={({ field: control }) => (
            <DrawerInput
              {...code.control}
              capitalize={false}
              value={control.value}
              onChange={(event) => control.onChange(codeOf(event.target.value))}
              onBlur={control.onBlur}
              maxLength={OFFER_FORM_LIMITS.code}
              placeholder={t(F.codePlaceholder)}
              autoComplete="off"
              data-testid={`${testId}-code`}
            />
          )}
        />
      </DrawerField>
      <DrawerField label={t(F.type)}>
        <Controller
          control={form.control}
          name="kind"
          render={({ field: control }) => (
            <DrawerChips
              label={t(F.type)}
              options={OFFER_KIND_VALUES.map((kind) => ({
                value: kind,
                label: tClinic(CLINIC_KEYS.offerings.offerKinds[kind]),
                tone: OFFER_KIND_TONES[kind],
              }))}
              value={control.value}
              onChange={(next) => {
                if (!next || next === control.value) return;
                control.onChange(next);
                form.setValue('value', KIND_START_VALUES[next], { shouldDirty: true });
                form.clearErrors('value');
              }}
              testId={`${testId}-kind`}
            />
          )}
        />
      </DrawerField>
      {/* The grid reads its children's spans: a half that stays a half (H:3839). */}
      <OfferValueField {...props} span="half" stretch={false} />
      <DrawerField label={t(F.colour)} hint={t(F.colourHint)}>
        <Controller
          control={form.control}
          name="tone"
          render={({ field: control }) => (
            <DrawerSwatches
              label={t(F.colour)}
              tones={
                OFFER_TONES.includes(control.value)
                  ? OFFER_TONES
                  : [...OFFER_TONES, control.value]
              }
              value={control.value}
              onChange={control.onChange}
              testId={`${testId}-colour`}
            />
          )}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/**
 * The Offerings picker's options (`offerings.md:101`): the active offerings —
 * and any picked one since made inactive — grouped by category, each with its
 * colour dot, its category and its base price.
 */
function useOfferingOptions(
  offerings: readonly OfferingRecord[],
  picked: readonly string[],
): PickerOption<OfferingRecord>[] {
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const formatPaise = usePaiseFormat();
  const rank = (offering: OfferingRecord) =>
    OFFERING_CATEGORY_VALUES.indexOf(offering.category);
  return offerings
    .filter((offering) => offering.active || picked.includes(offering.id))
    .sort((a, b) => rank(a) - rank(b))
    .map((offering) => {
      const category = tClinic(CLINIC_KEYS.offerings.categories[offering.category]);
      return {
        key: offering.id,
        label: offering.name,
        sub: category,
        meta: formatPaise(basePrice(offering)),
        group: category,
        groupTone: OFFERING_CATEGORY_TONES[offering.category],
        tone: offering.tone,
        keywords: offering.searchTerms,
        data: offering,
      };
    });
}

/**
 * Step 2, "Where it applies" (`offerings.md:101–105`): Offerings* (a multi
 * picker), Branches (two or more open branches), Starts and Ends (empty =
 * "Now" / "no end"), then one preview box per picked offering.
 */
export function OfferWhereFields({
  form,
  values,
  idPrefix,
  testId,
  offerings,
  branches,
  previews,
  today,
}: OfferFieldsProps & {
  offerings: readonly OfferingRecord[];
  branches: readonly Branch[];
  previews: readonly OfferPreviewBox[];
  today: string;
}) {
  const { t } = useTranslation(OFFER_DRAWER_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const picked = field('offeringIds');
  const starts = field('startsOn');
  const ends = field('endsOn');
  const options = useOfferingOptions(offerings, values.offeringIds);
  const shownBranches = values.branchIds.length > 0 ? values.branchIds : [ALL_BRANCHES];

  return (
    <DrawerFieldGrid>
      <DrawerField
        label={t(F.offerings)}
        htmlFor={picked.id}
        required
        hint={t(F.offeringsHint)}
        error={picked.error}
      >
        <Controller
          control={form.control}
          name="offeringIds"
          render={({ field: control }) => (
            <Picker
              multiple
              id={picked.id}
              aria-describedby={picked.control['aria-describedby']}
              invalid={Boolean(picked.error)}
              label={t(F.offerings)}
              placeholder={t(F.offeringsSearch)}
              searchPlaceholder={t(F.offeringsSearch)}
              searchable
              options={options}
              value={control.value}
              onChange={(ids) => control.onChange(ids)}
              size="md"
              testId={`${testId}-offerings`}
            />
          )}
        />
      </DrawerField>
      {branches.length > 1 ? (
        <DrawerField label={t(F.branches)} hint={t(F.branchesHint)}>
          <Controller
            control={form.control}
            name="branchIds"
            render={({ field: control }) => (
              <DrawerChips
                multiple
                label={t(F.branches)}
                options={[
                  { value: ALL_BRANCHES, label: t(CATALOGUE_CELLS_KEYS.allBranches) },
                  ...branches.map((branch) => ({
                    value: branch.id,
                    label: branch.name,
                    tone: branch.tone,
                  })),
                ]}
                value={shownBranches}
                onChange={(next) =>
                  control.onChange(
                    next.includes(ALL_BRANCHES) && !shownBranches.includes(ALL_BRANCHES)
                      ? []
                      : next.filter((id) => id !== ALL_BRANCHES),
                  )
                }
                testId={`${testId}-branches`}
              />
            )}
          />
        </DrawerField>
      ) : null}
      <DrawerField
        span="half"
        label={t(F.starts)}
        htmlFor={starts.id}
        error={starts.error}
      >
        <Controller
          control={form.control}
          name="startsOn"
          render={({ field: control }) => (
            <DatePicker
              id={starts.id}
              aria-describedby={starts.control['aria-describedby']}
              invalid={Boolean(starts.error)}
              value={control.value}
              onChange={control.onChange}
              label={t(F.starts)}
              today={today}
              {...DATE_WINDOW}
              clearable
              size="md"
              testId={`${testId}-starts`}
            />
          )}
        />
      </DrawerField>
      <DrawerField span="half" label={t(F.ends)} htmlFor={ends.id} error={ends.error}>
        <Controller
          control={form.control}
          name="endsOn"
          render={({ field: control }) => (
            <DatePicker
              id={ends.id}
              aria-describedby={ends.control['aria-describedby']}
              invalid={Boolean(ends.error)}
              value={control.value}
              onChange={(next) => {
                control.onChange(next);
                form.clearErrors('endsOn');
              }}
              label={t(F.ends)}
              today={today}
              {...DATE_WINDOW}
              clearable
              size="md"
              testId={`${testId}-ends`}
            />
          )}
        />
      </DrawerField>
      {previews.map(({ offering, text }) => (
        <DrawerField key={offering.id} span="half" label={offering.name}>
          <DrawerInfo testId={`${testId}-preview-${offering.id}`}>{text}</DrawerInfo>
        </DrawerField>
      ))}
    </DrawerFieldGrid>
  );
}

/** Step 3, "Notes" (`offerings.md:106–107`): the Note and the Live / Paused status. */
export function OfferNotesFields({ form, idPrefix, testId }: OfferFieldsProps) {
  const { t } = useTranslation(OFFER_DRAWER_NS);
  const note = useDrawerFieldIds(form, idPrefix)('note');
  return (
    <DrawerFieldGrid>
      <DrawerField label={t(F.note)} htmlFor={note.id} error={note.error}>
        <DrawerTextarea
          {...note.control}
          {...form.register('note')}
          rows={3}
          maxLength={OFFER_FORM_LIMITS.note}
          placeholder={t(F.notePlaceholder)}
          data-testid={`${testId}-note`}
        />
      </DrawerField>
      <DrawerField label={t(F.status)}>
        <Controller
          control={form.control}
          name="live"
          render={({ field: control }) => (
            <DrawerToggle
              aria-label={t(F.status)}
              checked={control.value}
              onCheckedChange={control.onChange}
              onLabel={t(F.live)}
              offLabel={t(F.paused)}
              data-testid={`${testId}-status`}
            />
          )}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}
