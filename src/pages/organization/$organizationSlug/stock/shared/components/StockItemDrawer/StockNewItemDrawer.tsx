import { useId, useState } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { SECTION_TONES } from '@/shared/app/app-tones.ts';
import {
  DrawerFieldGrid,
  DrawerStepBody,
} from '@/shared/components/DrawerField/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useStockWords } from '../../hooks/useStockWords/index.ts';
import { useQuickCreateStockItem } from '../../hooks/useStockWrites/index.ts';
import type { StockItemRecord } from '../../stock-contracts.ts';
import {
  STOCK_DRAWER_KEYS,
  STOCK_DRAWER_TEST_IDS,
  STOCK_DRAWERS_NS,
  STOCK_STACKED_SUFFIX,
} from '../../stock-drawers.constants.ts';
import { STOCK_NAME_MAX } from '../../stock-records-contracts.ts';
import {
  ItemCategoryField,
  ItemLevelField,
  ItemNameField,
  ItemUnitField,
} from './stock-item-fields.tsx';
import {
  newItemForm,
  QUICK_ITEM_UNITS,
  type StockItemFormValues,
} from './stock-item-form.ts';
import { ITEM_SERVER_FIELDS, useItemConflict } from './use-item-save.ts';

const K = STOCK_DRAWER_KEYS.quickItem;
const F = STOCK_DRAWER_KEYS.item.fields;

/** Five fields, the category chips heavy: 680px (`clinic-stock.md:282`). */
const CONTENT_PROFILE = { fieldCount: 5, hasHeavyField: true } as const;

/** Props of {@link StockNewItemDrawer}. */
export interface StockNewItemDrawerProps {
  open: boolean;
  /** "Back", ×, the backdrop or Esc: the parent row gets nothing. */
  onClose: () => void;
  /** The typed name from the row's picker. */
  name: string;
  /** The purchase's vendor — the new item comes from them. */
  vendorId?: string | null;
  /** The new item, selected in the purchase row that asked. */
  onSaved: (item: StockItemRecord) => void;
  testId?: string;
}

/**
 * New clinic item, stacked on a purchase (KICKOFF §6.8; `clinic-stock.md:187–201,
 * 275–287`): "Item" — Name* (the picker's text), Category (Creams & Serums),
 * Unit (piece · box · bottle · tube · pack · ml) — then "Details", Minimum 1 and
 * Maximum 5. "Back" · "Add item" posts the item at once with these and the
 * purchase's vendor (`POST /app/stock-items`, nothing in stock — the purchase
 * line receives it); a name another item has goes on Name. "Cotton added to
 * clinic items", and the item lands on the purchase row that asked.
 */
export function StockNewItemDrawer({
  open,
  onClose,
  name,
  vendorId = null,
  onSaved,
  testId = `${STOCK_DRAWER_TEST_IDS.quickItem}${STOCK_STACKED_SUFFIX}`,
}: StockNewItemDrawerProps) {
  const { session } = useDrawerSession(open);
  return (
    <NewItemSession
      key={session}
      open={open}
      onClose={onClose}
      name={name}
      vendorId={vendorId}
      onSaved={onSaved}
      testId={testId}
    />
  );
}

/** One opening: the form, its two steps and its save. */
function NewItemSession({
  open,
  onClose,
  name,
  vendorId,
  onSaved,
  testId,
}: Required<StockNewItemDrawerProps>) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  const idPrefix = `stock-new-item-${useId().replace(/:/g, '')}`;
  const form = useForm<StockItemFormValues>({
    defaultValues: {
      ...newItemForm(name.trim().slice(0, STOCK_NAME_MAX)),
      category: 'creams_serums',
      unit: 'piece',
      minQty: 1,
      maxQty: 5,
      vendorId,
    },
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<string>('item');
  const onConflict = useItemConflict(form, () => setOpenStep('item'));
  const create = useQuickCreateStockItem({
    notifyOnError: false,
    successMessage: (item) => t(K.added, { name: item.name }),
  });
  const { saveState, save } = useDrawerSave<StockItemFormValues, StockItemRecord>({
    form,
    serverFields: ITEM_SERVER_FIELDS,
    onConflict,
    fieldOrder: ['name', 'category', 'unit', 'minQty', 'maxQty'],
    toastId: 'stock-new-item-save-failed',
    onField: (field) =>
      setOpenStep(field === 'minQty' || field === 'maxQty' ? 'details' : 'item'),
    write: () => {
      const current = form.getValues();
      return create.mutateAsync({
        name: current.name.trim(),
        category: current.category,
        unit: current.unit,
        minQty: current.minQty,
        maxQty: current.maxQty,
        vendorId: current.vendorId,
      });
    },
    onDone: onSaved,
  });

  const body = { form, idPrefix, testId };
  const category = words.category(values.category);
  const steps: DrawerStep[] = [
    {
      id: 'item',
      title: t(K.steps.item),
      peek: [
        { kind: 'value', label: t(F.name), value: values.name.trim() },
        {
          kind: 'value',
          label: t(F.category),
          value: category.label,
          tone: category.tone ?? undefined,
        },
        { kind: 'value', label: t(F.unit), value: words.unit(values.unit) },
      ],
      missing: values.name.trim() ? [] : [t(F.name)],
      content: (
        <DrawerStepBody readOnly={false}>
          {/* The grid reads each field's width here: Name a half that stays a half. */}
          <DrawerFieldGrid>
            <ItemNameField {...body} span="half" stretch={false} />
            <ItemCategoryField {...body} />
            <ItemUnitField {...body} units={QUICK_ITEM_UNITS} />
          </DrawerFieldGrid>
        </DrawerStepBody>
      ),
    },
    {
      id: 'details',
      title: t(K.steps.details),
      peek: [
        { kind: 'value', label: t(F.min), value: String(values.minQty) },
        { kind: 'value', label: t(F.max), value: String(values.maxQty) },
      ],
      content: (
        <DrawerStepBody readOnly={false}>
          {/* Two thirds share the row as halves (H:4069). */}
          <DrawerFieldGrid>
            <ItemLevelField {...body} name="minQty" span="third" />
            <ItemLevelField {...body} name="maxQty" span="third" />
          </DrawerFieldGrid>
        </DrawerStepBody>
      ),
    },
  ];

  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={t(K.title)}
      sub={t(K.sub)}
      content={CONTENT_PROFILE}
      tone={SECTION_TONES.stock}
      steps={steps}
      openStep={openStep}
      onOpenStepChange={setOpenStep}
      summary={values.name.trim()}
      stacked
      saveLabel={t(STOCK_DRAWER_KEYS.item.save)}
      onSave={() => void save()}
      saveState={saveState}
      onMissing={() => notify.warning(t(STOCK_DRAWER_KEYS.addName))}
      dirty={isDirty}
      testId={testId}
    />
  );
}
