import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ALL_BRANCHES } from '@/shared/api/app/app-list-filters.ts';
import { OFFERING_CATEGORY_VALUES } from '@/shared/api/app/app-schema.ts';
import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import { GST_PERCENT_VALUES } from '@/shared/api/app/offerings-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { OFFERING_CATEGORY_TONES } from '@/shared/app/app-tones.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInfo,
  DrawerInput,
  DrawerNumberInput,
  DrawerStepper,
  DrawerSwatches,
  DrawerTextarea,
  DrawerToggle,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';

import { CATALOGUE_CELLS_KEYS } from '../../shared/components/CatalogueCells/index.ts';
import { OFFERING_DRAWER_KEYS, OFFERING_DRAWER_NS } from './offering-drawer.constants.ts';
import type { OfferOnThis } from './offering-drawer-view.ts';
import {
  DURATION_QUICK_PICKS,
  OFFERING_FORM_LIMITS,
  OFFERING_TONES,
  type OfferingFormValues,
  SESSION_QUICK_PICKS,
  VALIDITY_QUICK_PICKS,
} from './offering-form.ts';

const K = OFFERING_DRAWER_KEYS.groups;
const F = OFFERING_DRAWER_KEYS.fields;

/** What every group of fields reads: the form, the ids' prefix, the root test id. */
interface OfferingFieldsProps {
  form: UseFormReturn<OfferingFormValues>;
  /** Unique per drawer: the controls' DOM ids derive from it. */
  idPrefix: string;
  /** The drawer's root test id: the controls' derive from it (`offering-drawer-price`). */
  testId: string;
}

/** A group that derives from the form's live values (OFFERING, PRICING). */
interface OfferingValueFieldsProps extends OfferingFieldsProps {
  /** The form's values as they stand (`useWatch`), for what the fields derive. */
  values: OfferingFormValues;
}

/**
 * "Available at"'s picks (`offerings.md:66`): "All branches" is on while no
 * branch is; picking it clears the rest, and picking a branch turns it off.
 */
function nextBranchIds(next: readonly string[], shown: readonly string[]): string[] {
  if (next.includes(ALL_BRANCHES) && !shown.includes(ALL_BRANCHES)) return [];
  return next.filter((id) => id !== ALL_BRANCHES);
}

/**
 * The OFFERING section (`offerings.md:63–66`): Name* (half, alone on its row),
 * Category (one always picked), Colour (six swatches) and — with two or more
 * open branches — "Available at".
 */
export function OfferingIdentityFields({
  form,
  values,
  idPrefix,
  testId,
  branches,
}: OfferingValueFieldsProps & {
  /** The open branches; "Available at" shows with two or more. */
  branches: readonly BranchOption[];
}) {
  const { t } = useTranslation(OFFERING_DRAWER_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const name = field('name');
  const branchField = field('branchIds');
  // A saved offering in a colour outside the six keeps it, picked, at the end.
  const tones = OFFERING_TONES.includes(values.tone)
    ? OFFERING_TONES
    : [...OFFERING_TONES, values.tone];
  const shownBranches = values.branchIds.length > 0 ? values.branchIds : [ALL_BRANCHES];

  return (
    <DrawerFieldGrid title={t(K.offering)}>
      <DrawerField
        span="half"
        stretch={false}
        label={t(F.name)}
        htmlFor={name.id}
        required
        error={name.error}
      >
        <DrawerInput
          {...name.control}
          {...form.register('name')}
          aria-required="true"
          maxLength={OFFERING_FORM_LIMITS.name}
          placeholder={t(F.namePlaceholder)}
          autoComplete="off"
          data-testid={`${testId}-name`}
        />
      </DrawerField>
      <DrawerField label={t(F.category)}>
        <Controller
          control={form.control}
          name="category"
          render={({ field: control }) => (
            <DrawerChips
              label={t(F.category)}
              options={OFFERING_CATEGORY_VALUES.map((category) => ({
                value: category,
                label: tApp(APP_KEYS.offerings.categories[category]),
                tone: OFFERING_CATEGORY_TONES[category],
              }))}
              value={control.value}
              onChange={(next) => {
                if (next) control.onChange(next);
              }}
              testId={`${testId}-category`}
            />
          )}
        />
      </DrawerField>
      <DrawerField label={t(F.colour)} hint={t(F.colourHint)}>
        <Controller
          control={form.control}
          name="tone"
          render={({ field: control }) => (
            <DrawerSwatches
              label={t(F.colour)}
              tones={tones}
              value={control.value}
              onChange={control.onChange}
              testId={`${testId}-colour`}
            />
          )}
        />
      </DrawerField>
      {branches.length > 1 ? (
        <DrawerField
          label={t(F.availableAt)}
          hint={t(F.availableAtHint)}
          error={branchField.error}
        >
          <Controller
            control={form.control}
            name="branchIds"
            render={({ field: control }) => (
              <DrawerChips
                multiple
                label={t(F.availableAt)}
                options={[
                  { value: ALL_BRANCHES, label: t(CATALOGUE_CELLS_KEYS.allBranches) },
                  ...branches.map((branch) => ({
                    value: branch.id,
                    label: branch.name,
                    tone: branch.tone,
                  })),
                ]}
                value={shownBranches}
                onChange={(next) => control.onChange(nextBranchIds(next, shownBranches))}
                testId={`${testId}-branches`}
              />
            )}
          />
        </DrawerField>
      ) : null}
    </DrawerFieldGrid>
  );
}

/**
 * The GST rate chips — the rates the API takes (0 · 5 · 12 · 18 · 28). A new
 * offering starts with none picked: the server then applies the category's rate,
 * as the field's hint says; once picked, a rate stays picked.
 */
function GstRateChips({ form, testId }: Omit<OfferingFieldsProps, 'idPrefix'>) {
  const { t } = useTranslation(OFFERING_DRAWER_NS);
  return (
    <Controller
      control={form.control}
      name="gstPercent"
      render={({ field: control }) => (
        <DrawerChips
          label={t(F.gstRate)}
          options={GST_PERCENT_VALUES.map((value) => ({
            value: String(value),
            label: t(F.gstChip, { value }),
          }))}
          value={control.value === '' ? null : control.value}
          onChange={(next) => {
            if (next) control.onChange(next);
          }}
          testId={`${testId}-gst-rate`}
        />
      )}
    />
  );
}

/**
 * The PRICE & SESSIONS section (`offerings.md:67–75`): Price* · Offer price ·
 * Sessions, GST rate (chips) · GST · Lowest price (with "See the lowest price",
 * and its ₹ field while it reads Shown), then "Billed today" once a price is
 * set. The Lowest price shows only to a member with
 * `offering:lower_price:read`; prices need no code of their own (O3).
 */
export function OfferingPriceFields({
  form,
  values,
  idPrefix,
  testId,
  floor,
  offerPriceHint,
  billedToday,
}: OfferingValueFieldsProps & {
  /** The Lowest price control — only with `offering:lower_price:read`; Hidden on every open. */
  floor: { shown: boolean; onShownChange: (shown: boolean) => void } | null;
  offerPriceHint: string;
  /** The read-only "Billed today" line, once Price is above 0. */
  billedToday: string | null;
}) {
  const { t } = useTranslation(OFFERING_DRAWER_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const price = field('price');
  const offer = field('offerPrice');
  const sessions = field('sessions');
  const gst = field('gstPercent');
  const floorField = field('minPrice');
  const currency = tDrawer(RECORD_DRAWER_KEYS.currency);

  return (
    <DrawerFieldGrid title={t(K.price)}>
      <DrawerField
        span="third"
        label={t(F.price)}
        htmlFor={price.id}
        required
        hint={t(F.priceHint)}
        error={price.error}
      >
        <Controller
          control={form.control}
          name="price"
          render={({ field: control }) => (
            <DrawerNumberInput
              {...price.control}
              aria-required="true"
              value={control.value}
              onValueChange={control.onChange}
              onBlur={control.onBlur}
              prefix={currency}
              placeholder="0"
              maxLength={OFFERING_FORM_LIMITS.money}
              data-testid={`${testId}-price`}
            />
          )}
        />
      </DrawerField>
      <DrawerField
        span="third"
        label={t(F.offerPrice)}
        htmlFor={offer.id}
        hint={offerPriceHint}
        error={offer.error}
      >
        <Controller
          control={form.control}
          name="offerPrice"
          render={({ field: control }) => (
            <DrawerNumberInput
              {...offer.control}
              value={control.value}
              onValueChange={control.onChange}
              onBlur={control.onBlur}
              prefix={currency}
              placeholder={values.price || '0'}
              maxLength={OFFERING_FORM_LIMITS.money}
              data-testid={`${testId}-offer-price`}
            />
          )}
        />
      </DrawerField>
      <DrawerField
        span="third"
        label={t(F.sessions)}
        htmlFor={sessions.id}
        hint={t(F.sessionsHint)}
        error={sessions.error}
      >
        <Controller
          control={form.control}
          name="sessions"
          render={({ field: control }) => (
            <DrawerStepper
              id={sessions.id}
              label={t(F.sessions)}
              value={control.value}
              onValueChange={control.onChange}
              min={OFFERING_FORM_LIMITS.sessionsMin}
              max={OFFERING_FORM_LIMITS.sessions}
              quick={SESSION_QUICK_PICKS.map((count) => ({
                label: String(count),
                value: count,
              }))}
              testId={`${testId}-sessions`}
            />
          )}
        />
      </DrawerField>
      <DrawerField
        span="half"
        label={t(F.gstRate)}
        hint={values.gstPercent === '' ? t(F.gstHint) : undefined}
        error={gst.error}
      >
        <GstRateChips form={form} testId={testId} />
      </DrawerField>
      <DrawerField span="third" label={t(F.gst)}>
        <Controller
          control={form.control}
          name="isGstInclusive"
          render={({ field: control }) => (
            <DrawerToggle
              aria-label={t(F.gst)}
              checked={control.value}
              onCheckedChange={control.onChange}
              onLabel={t(F.gstInclusive)}
              offLabel={t(F.gstExclusive)}
              data-testid={`${testId}-gst`}
            />
          )}
        />
      </DrawerField>
      {floor ? (
        <DrawerField span="third" label={t(F.floor)}>
          <DrawerToggle
            aria-label={t(F.floor)}
            checked={floor.shown}
            onCheckedChange={floor.onShownChange}
            onLabel={t(F.floorShown)}
            offLabel={t(F.floorHidden)}
            data-testid={`${testId}-floor-toggle`}
          />
        </DrawerField>
      ) : null}
      {floor?.shown ? (
        <DrawerField
          span="half"
          stretch={false}
          label={t(F.floor)}
          htmlFor={floorField.id}
          hint={t(F.floorHint)}
          error={floorField.error}
        >
          <Controller
            control={form.control}
            name="minPrice"
            render={({ field: control }) => (
              <DrawerNumberInput
                {...floorField.control}
                value={control.value}
                onValueChange={control.onChange}
                onBlur={control.onBlur}
                prefix={currency}
                placeholder={values.offerPrice || values.price || '0'}
                maxLength={OFFERING_FORM_LIMITS.money}
                data-testid={`${testId}-floor`}
              />
            )}
          />
        </DrawerField>
      ) : null}
      {billedToday ? (
        <DrawerField label={t(F.billedToday)}>
          <DrawerInfo testId={`${testId}-billed-today`}>{billedToday}</DrawerInfo>
        </DrawerField>
      ) : null}
    </DrawerFieldGrid>
  );
}

/**
 * OFFERS ON THIS (`offerings.md:74`): one read-only box per offer that has not
 * ended — "+1 session · Running · till 31 Oct 2026" under the offer's name.
 */
export function OffersOnThisFields({
  offersOnThis,
  testId,
}: {
  offersOnThis: readonly OfferOnThis[];
  testId: string;
}) {
  const { t } = useTranslation(OFFERING_DRAWER_NS);
  return (
    <DrawerFieldGrid title={t(K.offers)}>
      {offersOnThis.map(({ offer, text }) => (
        <DrawerField key={offer.id} span="half" label={offer.name}>
          <DrawerInfo testId={`${testId}-offer-${offer.id}`}>{text}</DrawerInfo>
        </DrawerField>
      ))}
    </DrawerFieldGrid>
  );
}

/** TIME & VALIDITY (`offerings.md:76–77`): Duration and Validity, each a stepper with quick picks. */
export function OfferingTimeFields({ form, idPrefix, testId }: OfferingFieldsProps) {
  const { t } = useTranslation(OFFERING_DRAWER_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const duration = field('durationMinutes');
  const validity = field('validityDays');
  return (
    <DrawerFieldGrid title={t(K.time)}>
      <DrawerField
        span="half"
        label={t(F.duration)}
        htmlFor={duration.id}
        error={duration.error}
      >
        <Controller
          control={form.control}
          name="durationMinutes"
          render={({ field: control }) => (
            <DrawerStepper
              id={duration.id}
              label={t(F.duration)}
              value={control.value}
              onValueChange={control.onChange}
              min={OFFERING_FORM_LIMITS.durationMinutesMin}
              max={OFFERING_FORM_LIMITS.durationMinutes}
              suffix={t(F.minutesUnit)}
              quick={DURATION_QUICK_PICKS.map((minutes) => ({
                label: t(F.durationQuick, { minutes }),
                value: minutes,
              }))}
              testId={`${testId}-duration`}
            />
          )}
        />
      </DrawerField>
      <DrawerField
        span="half"
        label={t(F.validity)}
        htmlFor={validity.id}
        hint={t(F.validityHint)}
        error={validity.error}
      >
        <Controller
          control={form.control}
          name="validityDays"
          render={({ field: control }) => (
            <DrawerStepper
              id={validity.id}
              label={t(F.validity)}
              value={control.value}
              onValueChange={control.onChange}
              max={OFFERING_FORM_LIMITS.validityDays}
              suffix={t(F.daysUnit)}
              quick={VALIDITY_QUICK_PICKS.map((pick) => ({
                label: t(F.validityQuick[pick.id]),
                value: pick.days,
              }))}
              testId={`${testId}-validity`}
            />
          )}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/**
 * DETAILS (`offerings.md:78–80`): Search terms (split on commas), Description
 * and Status. Its own step's only section carries no label of its own — the
 * step head names it (H:3836).
 */
export function OfferingDetailsFields({
  form,
  idPrefix,
  testId,
  titled,
}: OfferingFieldsProps & { titled: boolean }) {
  const { t } = useTranslation(OFFERING_DRAWER_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const terms = field('searchTerms');
  const description = field('description');
  return (
    <DrawerFieldGrid title={titled ? t(K.details) : undefined}>
      <DrawerField
        label={t(F.searchTerms)}
        htmlFor={terms.id}
        hint={t(F.searchTermsHint)}
        error={terms.error}
      >
        <DrawerInput
          {...terms.control}
          {...form.register('searchTerms')}
          capitalize={false}
          maxLength={OFFERING_FORM_LIMITS.searchTerms}
          placeholder={t(F.searchTermsPlaceholder)}
          autoComplete="off"
          data-testid={`${testId}-search-terms`}
        />
      </DrawerField>
      <DrawerField
        label={t(F.description)}
        htmlFor={description.id}
        error={description.error}
      >
        <DrawerTextarea
          {...description.control}
          {...form.register('description')}
          rows={3}
          maxLength={OFFERING_FORM_LIMITS.description}
          placeholder={t(F.descriptionPlaceholder)}
          data-testid={`${testId}-description`}
        />
      </DrawerField>
      <DrawerField label={t(F.status)}>
        <Controller
          control={form.control}
          name="isActive"
          render={({ field: control }) => (
            <DrawerToggle
              aria-label={t(F.status)}
              checked={control.value}
              onCheckedChange={control.onChange}
              onLabel={t(F.active)}
              offLabel={t(F.inactive)}
              data-testid={`${testId}-status`}
            />
          )}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}
