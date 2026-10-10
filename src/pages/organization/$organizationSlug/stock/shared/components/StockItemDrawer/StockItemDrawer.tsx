import { useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { numberFromText } from '@/lib/number-text.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { SECTION_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerFieldGrid,
  DrawerStepBody,
} from '@/shared/components/DrawerField/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import {
  RecordDrawer,
  RecordDrawerPending,
} from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useEditingRecord } from '@/shared/hooks/useEditingRecord/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useStockDrawerAccess } from '../../hooks/useStockAccess/index.ts';
import { useStockVendorCatalogue } from '../../hooks/useStockLists/index.ts';
import type { OpenStockChild } from '../../hooks/useStockStack/index.ts';
import { useStockWords } from '../../hooks/useStockWords/index.ts';
import {
  useCreateStockItem,
  useUpdateStockItem,
} from '../../hooks/useStockWrites/index.ts';
import type { StockItemRecord, StockItemRow } from '../../stock-contracts.ts';
import {
  STOCK_DRAWER_KEYS,
  STOCK_DRAWER_TEST_IDS,
  STOCK_DRAWERS_NS,
} from '../../stock-drawers.constants.ts';
import { MILLI } from '../../stock-units.ts';
import {
  itemDeleteBlock,
  StockDeleteConfirm,
  useStockDeleteBlockText,
} from '../StockDeleteConfirm/index.ts';
import {
  ItemCategoryField,
  ItemContentsField,
  type ItemFieldProps,
  ItemLevelField,
  ItemMeasureField,
  ItemNameField,
  ItemQuantityField,
  ItemUnitField,
  ItemVendorField,
} from './stock-item-fields.tsx';
import {
  ITEM_UNITS,
  itemFormOf,
  itemInputOf,
  newItemForm,
  type StockItemFormValues,
} from './stock-item-form.ts';
import { ITEM_SERVER_FIELDS, readStockItem, useItemConflict } from './use-item-save.ts';

const K = STOCK_DRAWER_KEYS.item;

/** Ten fields, the Unit chips heavy: 680px (`clinic-stock.md:227`). */
const CONTENT_PROFILE = { fieldCount: 10, hasHeavyField: true } as const;

/** What every use of the drawer passes. */
interface StockItemDrawerBaseProps {
  open: boolean;
  /** Every exit once the dirty guard lets it through — and after a save or a delete. */
  onClose: () => void;
  /** Opens a vendor on top for "New clinic vendor · “q”". */
  openChild?: OpenStockChild;
  testId?: string;
}

/** Props of {@link StockItemDrawer}: New item, or Edit item once loaded. */
export type StockItemDrawerProps = StockItemDrawerBaseProps &
  (
    | { mode: 'create'; prefill?: { name?: string } }
    | { mode: 'edit'; item: StockItemRow | undefined }
  );

/** The step that holds a field the save stopped on. */
const stepOfField = (field: string) => {
  if (['inStock', 'usage', 'minQty', 'maxQty'].includes(field)) return 'levels';
  return field === 'vendorId' ? 'vendor' : 'item';
};

/** The step cards: Item → Levels → Supplier (`clinic-stock.md:229`). */
function useSteps(
  body: ItemFieldProps & { openChild?: OpenStockChild },
  values: StockItemFormValues,
  readOnly: boolean,
): DrawerStep[] {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const words = useStockWords();
  const vendors = useStockVendorCatalogue().data ?? [];
  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const name = values.name.trim();
  const category = words.category(values.category);
  const unit = words.unit(values.unit);
  const contents = numberFromText(values.contents, MILLI);
  const contentsText =
    contents > 0 ? words.amount(contents / MILLI, words.measure(values.measure)) : '';
  const inStock = values.inStock
    ? words.units({ unit: values.unit }, numberFromText(values.inStock, MILLI))
    : '';
  const usage = values.usage
    ? words.units({ unit: values.unit }, numberFromText(values.usage, MILLI))
    : '';
  const vendor = vendors.find((entry) => entry.id === values.vendorId);
  return [
    {
      id: 'item',
      title: t(K.steps.item),
      summary: [name, category.label, unit].filter(Boolean).join(' · ') || notFilled,
      peek: [
        { kind: 'value', label: t(K.fields.name), value: name },
        {
          kind: 'value',
          label: t(K.fields.category),
          value: category.label,
          tone: category.tone ?? undefined,
        },
        { kind: 'value', label: t(K.fields.unit), value: unit },
        { kind: 'value', label: t(K.fields.contents, { unit }), value: contentsText },
      ],
      missing: name ? [] : [t(K.fields.name)],
      content: (
        <DrawerStepBody readOnly={readOnly}>
          {/* The grid reads each field's width here (H:5270): Name a half that
              stays a half, "Contents per" a third beside "Measured in". */}
          <DrawerFieldGrid>
            <ItemNameField {...body} span="half" stretch={false} />
            <ItemCategoryField {...body} />
            <ItemUnitField {...body} units={ITEM_UNITS} />
            <ItemContentsField {...body} span="third" />
            <ItemMeasureField {...body} span="half" />
          </DrawerFieldGrid>
        </DrawerStepBody>
      ),
    },
    {
      id: 'levels',
      title: t(K.steps.levels),
      summary:
        [inStock, `${values.minQty}–${values.maxQty}`].filter(Boolean).join(' · ') ||
        notFilled,
      peek: [
        { kind: 'value', label: t(K.fields.inStock), value: inStock },
        { kind: 'value', label: t(K.fields.usage), value: usage },
        { kind: 'value', label: t(K.fields.min), value: String(values.minQty) },
        { kind: 'value', label: t(K.fields.max), value: String(values.maxQty) },
      ],
      content: (
        <DrawerStepBody readOnly={readOnly}>
          {/* Four thirds (H:5271): In stock, Usage and Minimum, then Maximum alone at half. */}
          <DrawerFieldGrid>
            <ItemQuantityField {...body} name="inStock" span="third" />
            <ItemQuantityField {...body} name="usage" span="third" />
            <ItemLevelField {...body} name="minQty" span="third" />
            <ItemLevelField {...body} name="maxQty" span="third" />
          </DrawerFieldGrid>
        </DrawerStepBody>
      ),
    },
    {
      id: 'vendor',
      title: t(K.steps.vendor),
      summary: vendor?.name ?? notFilled,
      peek: [{ kind: 'value', label: t(K.fields.vendor), value: vendor?.name ?? '' }],
      content: (
        <DrawerStepBody readOnly={readOnly}>
          <DrawerFieldGrid>
            <ItemVendorField {...body} span="half" stretch={false} />
          </DrawerFieldGrid>
        </DrawerStepBody>
      ),
    },
  ];
}

/**
 * The red Delete: only an item with nothing in stock goes (`409 item_has_stock`),
 * so one with stock says why — "adjust it to 0 first" — instead of asking.
 */
function useItemDelete(record: StockItemRecord | null, ask: () => void) {
  const blockText = useStockDeleteBlockText();
  return () => {
    const block = record ? itemDeleteBlock(record) : null;
    if (block) notify.info(blockText(block));
    else ask();
  };
}

/** One opening of the drawer: the form, its steps and its save. */
function ItemSession({
  open,
  onClose,
  item,
  prefill,
  openChild,
  testId,
}: StockItemDrawerBaseProps & {
  item: StockItemRow | null;
  prefill?: { name?: string };
  testId: string;
}) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  const { readOnly, canDelete } = useStockDrawerAccess(item !== null);
  const idPrefix = `stock-item-${useId().replace(/:/g, '')}`;
  const form: UseFormReturn<StockItemFormValues> = useForm<StockItemFormValues>({
    defaultValues: item ? itemFormOf(item) : newItemForm(prefill?.name?.trim() ?? ''),
  });
  const { record, reload } = useEditingRecord({
    record: item,
    form,
    formOf: itemFormOf,
    read: readStockItem,
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<string>('item');
  const [deleting, setDeleting] = useState(false);
  const askDelete = useItemDelete(record, () => setDeleting(true));
  const onConflict = useItemConflict(form, () => setOpenStep('item'));

  const create = useCreateStockItem({ notifyOnError: false, successMessage: t(K.saved) });
  const update = useUpdateStockItem({ notifyOnError: false, successMessage: t(K.saved) });
  const { saveState, save } = useDrawerSave<StockItemFormValues, StockItemRecord>({
    form,
    serverFields: ITEM_SERVER_FIELDS,
    onConflict,
    onStale: record ? () => void reload() : undefined,
    fieldOrder: [
      'name',
      'category',
      'unit',
      'contents',
      'measure',
      'inStock',
      'usage',
      'minQty',
      'maxQty',
      'vendorId',
    ],
    toastId: 'stock-item-save-failed',
    onField: (field) => setOpenStep(stepOfField(field)),
    write: () => {
      const input = itemInputOf(form.getValues());
      return record ? update.mutateAsync({ record, input }) : create.mutateAsync(input);
    },
    onDone: () => onClose(),
  });

  const steps = useSteps({ form, idPrefix, testId, openChild }, values, readOnly);
  const category = words.category(values.category);

  return (
    <>
      <RecordDrawer
        open={open}
        onClose={onClose}
        title={t(item ? K.title.edit : K.title.create)}
        tag={item ? displayId.stockItem(item.seq) : undefined}
        sub={t(K.sub)}
        badges={[
          { id: 'category', label: category.label, tone: category.tone ?? undefined },
        ]}
        content={CONTENT_PROFILE}
        tone={SECTION_TONES.stock}
        steps={steps}
        openStep={openStep}
        onOpenStepChange={setOpenStep}
        summary={values.name.trim()}
        readOnly={readOnly}
        saveLabel={t(item ? STOCK_DRAWER_KEYS.saveChanges : K.save)}
        onSave={() => void save()}
        saveState={saveState}
        onDelete={canDelete ? askDelete : undefined}
        onMissing={() => notify.warning(t(STOCK_DRAWER_KEYS.addName))}
        dirty={isDirty}
        testId={testId}
      />
      {record ? (
        <StockDeleteConfirm
          target={
            deleting
              ? {
                  kind: 'item',
                  id: record.id,
                  name: record.name,
                  record: values.name.trim() || record.name,
                  from: 'drawer',
                }
              : null
          }
          onClose={() => setDeleting(false)}
          onDeleted={onClose}
        />
      ) : null}
    </>
  );
}

/**
 * New / Edit item (KICKOFF §6.8 Drawers; `clinic-stock.md:105–124, 219–231`) on
 * the shared record drawer, 680px: "Item" — Name*, Category, Unit, Contents
 * per <unit> and what they are measured in — "Levels" — In stock, Usage per
 * week, Minimum, Maximum — and "Supplier", a clinic vendor ("New clinic
 * vendor" stacked). The header carries "#167" and the category pill. On
 * clinozy-be: New item posts the item with In stock as its opening quantity
 * (`POST /app/stock-items`); Edit patches what changed with the read's
 * `updated_at`, then a changed In stock is an Adjust movement — the item's
 * quantity moves only with movements. A name another item has goes on Name; a
 * save over someone else's offers "Reload". "Item saved"; editing adds the red
 * Delete (Stock Delete) — at zero "Soframycin 30 gm deleted" + Undo, with
 * stock "adjust it to 0 first".
 */
export function StockItemDrawer(props: StockItemDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const testId = props.testId ?? STOCK_DRAWER_TEST_IDS.item;
  if (props.mode === 'edit' && !props.item) {
    return (
      <RecordDrawerPending
        open={props.open}
        onClose={props.onClose}
        title={t(K.title.edit)}
        sub={t(K.sub)}
        recordLabel={t(STOCK_DRAWER_KEYS.records.item)}
        content={CONTENT_PROFILE}
        testId={testId}
      />
    );
  }
  const item = props.mode === 'edit' ? (props.item ?? null) : null;
  return (
    <ItemSession
      key={`${session}-${item?.id ?? 'new'}`}
      {...props}
      item={item}
      prefill={props.mode === 'create' ? props.prefill : undefined}
      testId={testId}
    />
  );
}
