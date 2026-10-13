import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  DrawerChips,
  DrawerField,
  type DrawerFieldProps,
  DrawerInput,
  DrawerNumberInput,
  DrawerStepper,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';

import type { OpenStockChild } from '../../hooks/useStockStack/index.ts';
import { useStockWords } from '../../hooks/useStockWords/index.ts';
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';
import { STOCK_NAME_MAX } from '../../stock-records-contracts.ts';
import { STOCK_CATEGORY_TONES } from '../../stock-units.ts';
import { StockVendorPicker } from '../StockPickers/index.ts';
import {
  FIGURE_MAX_LENGTH,
  LEVEL_MAX,
  MEASURES,
  type StockItemFormValues,
} from './stock-item-form.ts';

const K = STOCK_DRAWER_KEYS.item.fields;

/**
 * What every item field reads. `span` and `stretch` are for the drawer grid,
 * which reads its children's props: each field is one grid child, and its
 * width is given where the drawer places it (H:3836–3839, H:5270).
 */
export interface ItemFieldProps extends Pick<DrawerFieldProps, 'span' | 'stretch'> {
  form: UseFormReturn<StockItemFormValues>;
  idPrefix: string;
  testId: string;
}

/** What a chip field reads: its chips label themselves, so it takes no DOM id. */
type ItemChipFieldProps = Omit<ItemFieldProps, 'idPrefix'>;

/** Name* (`clinic-stock.md:109`) — no placeholder (the prototype's "e.g. Priya Shah" is a slip, §7.3). */
export function ItemNameField({ form, idPrefix, testId }: ItemFieldProps) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const name = useDrawerFieldIds(form, idPrefix)('name');
  return (
    <DrawerField label={t(K.name)} htmlFor={name.id} required error={name.error}>
      <DrawerInput
        {...name.control}
        {...form.register('name')}
        aria-required="true"
        maxLength={STOCK_NAME_MAX}
        autoComplete="off"
        data-testid={`${testId}-name`}
      />
    </DrawerField>
  );
}

/** Category: the six in their tones (`clinic-stock.md:110`). */
export function ItemCategoryField({ form, testId }: ItemChipFieldProps) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  return (
    <DrawerField label={t(K.category)}>
      <Controller
        control={form.control}
        name="category"
        render={({ field: control }) => (
          <DrawerChips
            label={t(K.category)}
            options={(
              Object.keys(STOCK_CATEGORY_TONES) as StockItemFormValues['category'][]
            ).map((category) => ({
              value: category,
              label: words.category(category).label,
              tone: STOCK_CATEGORY_TONES[category],
            }))}
            value={control.value}
            onChange={(value) => {
              if (value) control.onChange(value);
            }}
            testId={`${testId}-category`}
          />
        )}
      />
    </DrawerField>
  );
}

/** Unit: the drawer's chips (`clinic-stock.md:111`; the stacked item's six, `:193`). */
export function ItemUnitField({
  form,
  testId,
  units,
}: ItemChipFieldProps & { units: readonly StockItemFormValues['unit'][] }) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  return (
    <DrawerField label={t(K.unit)}>
      <Controller
        control={form.control}
        name="unit"
        render={({ field: control }) => (
          <DrawerChips
            label={t(K.unit)}
            options={units.map((unit) => ({ value: unit, label: words.unit(unit) }))}
            value={control.value}
            onChange={(value) => {
              if (value) control.onChange(value);
            }}
            testId={`${testId}-unit`}
          />
        )}
      />
    </DrawerField>
  );
}

/**
 * "Contents per tube" (`clinic-stock.md:112`): decimals, the measure as the
 * suffix, "optional · lets the team use part of a tube".
 */
export function ItemContentsField({ form, idPrefix, testId }: ItemFieldProps) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  const contents = useDrawerFieldIds(form, idPrefix)('contents');
  const unit = words.unit(useWatch({ control: form.control, name: 'unit' }));
  const measure = useWatch({ control: form.control, name: 'measure' });
  return (
    <DrawerField
      label={t(K.contents, { unit })}
      hint={t(K.contentsHint, { unit })}
      htmlFor={contents.id}
      error={contents.error}
    >
      <Controller
        control={form.control}
        name="contents"
        render={({ field: control }) => (
          <DrawerNumberInput
            {...contents.control}
            value={control.value}
            onValueChange={control.onChange}
            onBlur={control.onBlur}
            suffix={words.measure(measure)}
            decimals={2}
            maxLength={FIGURE_MAX_LENGTH}
            data-testid={`${testId}-contents`}
          />
        )}
      />
    </DrawerField>
  );
}

/** "Measured in": ml · g · pcs · units (`clinic-stock.md:113`). */
export function ItemMeasureField({ form, testId }: ItemChipFieldProps) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  return (
    <DrawerField label={t(K.measure)}>
      <Controller
        control={form.control}
        name="measure"
        render={({ field: control }) => (
          <DrawerChips
            label={t(K.measure)}
            options={MEASURES.map((value) => ({ value, label: words.measure(value) }))}
            value={control.value}
            onChange={(value) => {
              if (value) control.onChange(value);
            }}
            testId={`${testId}-measure`}
          />
        )}
      />
    </DrawerField>
  );
}

/** In stock or Usage per week: decimals in the item's unit (`clinic-stock.md:114–115`). */
export function ItemQuantityField({
  form,
  idPrefix,
  testId,
  name,
}: ItemFieldProps & { name: 'inStock' | 'usage' }) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  const ids = useDrawerFieldIds(form, idPrefix)(name);
  const unit = words.unit(useWatch({ control: form.control, name: 'unit' }));
  return (
    <DrawerField
      label={t(name === 'inStock' ? K.inStock : K.usage)}
      hint={name === 'inStock' ? t(K.decimals) : undefined}
      htmlFor={ids.id}
      error={ids.error}
    >
      <Controller
        control={form.control}
        name={name}
        render={({ field: control }) => (
          <DrawerNumberInput
            {...ids.control}
            value={control.value}
            onValueChange={control.onChange}
            onBlur={control.onBlur}
            suffix={unit}
            decimals={3}
            maxLength={FIGURE_MAX_LENGTH}
            data-testid={`${testId}-${name === 'inStock' ? 'in-stock' : 'usage'}`}
          />
        )}
      />
    </DrawerField>
  );
}

/**
 * Minimum or Maximum: a stepper of whole steps (`clinic-stock.md:116–117`) —
 * a level saved with decimals keeps them; a maximum under the minimum is the
 * API's 400, said here.
 */
export function ItemLevelField({
  form,
  idPrefix,
  testId,
  name,
}: ItemFieldProps & { name: 'minQty' | 'maxQty' }) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const label = t(name === 'minQty' ? K.min : K.max);
  const ids = useDrawerFieldIds(form, idPrefix)(name);
  return (
    <DrawerField label={label} htmlFor={ids.id} error={ids.error}>
      <Controller
        control={form.control}
        name={name}
        render={({ field: control }) => (
          <DrawerStepper
            id={ids.id}
            value={control.value}
            onValueChange={control.onChange}
            min={0}
            max={LEVEL_MAX}
            label={label}
            testId={`${testId}-${name === 'minQty' ? 'min' : 'max'}`}
          />
        )}
      />
    </DrawerField>
  );
}

/** Supplier: the clinic vendors, "New clinic vendor" stacked (`clinic-stock.md:118`). */
export function ItemVendorField({
  form,
  idPrefix,
  testId,
  openChild,
}: ItemFieldProps & { openChild?: OpenStockChild }) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const vendor = useDrawerFieldIds(form, idPrefix)('vendorId');
  return (
    <DrawerField
      label={t(K.vendor)}
      hint={t(STOCK_DRAWER_KEYS.pickers.vendorsHint)}
      htmlFor={vendor.id}
      error={vendor.error}
    >
      <Controller
        control={form.control}
        name="vendorId"
        render={({ field: control }) => (
          <StockVendorPicker
            id={vendor.id}
            label={t(K.vendor)}
            value={control.value}
            onChange={control.onChange}
            openChild={openChild}
            testId={`${testId}-vendor`}
          />
        )}
      />
    </DrawerField>
  );
}
