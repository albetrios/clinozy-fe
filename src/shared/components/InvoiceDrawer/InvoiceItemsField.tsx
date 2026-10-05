import { type UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  belowFloor,
  discountForFinal,
  lineFinal,
} from '@/shared/api/clinic/clinic-money.ts';
import type { OfferingCategory } from '@/shared/api/clinic/clinic-schema.ts';
import { INVOICE_QTY_MAX } from '@/shared/api/clinic/invoices-contracts.ts';
import { CLINIC_KEYS } from '@/shared/clinic/clinic.constants.ts';
import { MoneyCell } from '@/shared/components/Cells/index.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import {
  nameNumbers,
  QuickLine,
  type QuickLineBrowseConfig,
  quickLineBrowseMatches,
  type QuickLineItem,
  quickLineMatches,
  type QuickLineTerm,
  type QuickLineTermValues,
  quickLineTypedName,
  useQuickLineTerms,
} from '@/shared/components/QuickLine/index.ts';
import {
  type ItemsColumn,
  ItemsField,
  ItemsNumberCell,
  ItemsNumberInput,
  ItemsPickerCell,
  ItemsQtyCell,
} from '@/shared/forms/ItemsField/index.ts';
import { useQuickCreateMedicine } from '@/shared/hooks/useMedicines/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
  INVOICE_DRAWER_TEST_IDS,
} from './invoice-drawer.constants.ts';
import {
  blankLine,
  type InvoiceFormValues,
  type InvoiceLineForm,
  namedLines,
} from './invoice-form.ts';
import {
  type InvoiceCatalogItem,
  lineFromCatalog,
  medicineCatalogItem,
} from './invoice-lines.ts';
import { withAddedLine, withSteppedLine } from './invoice-rows.ts';
import type { InvoiceCatalog } from './use-invoice-catalog.ts';

const K = INVOICE_DRAWER_KEYS.items;

/** What an invoice line reads (`payments.md:140`): "2 = qty · 10% = discount · @500 = rate". */
const INVOICE_LINE_TERMS: readonly QuickLineTerm[] = ['qty', 'discount', 'rate'];

/** Props of {@link InvoiceItemsField}. */
export interface InvoiceItemsFieldProps {
  form: UseFormReturn<InvoiceFormValues>;
  values: InvoiceFormValues;
  catalog: InvoiceCatalog;
  /** The row's lowest Final (H:5059; `disc`, Q-U8) — null without one. */
  floorOf: (row: InvoiceLineForm) => number | null;
  /** The role sees the floor's price (`floor`, Q-U8): the tooltip names it. */
  floorVisible: boolean;
  /** "Often billed" (H:5058), as catalogue entries. */
  oftenBilled: readonly InvoiceCatalogItem[];
  /** The bill the table's footer shows (H:5059). */
  total: number;
  readOnly: boolean;
  /** A sale's medicines are never changed (`S:51`): the rows show, nothing edits them. */
  locked: boolean;
  /** A medicine the store lacks may become a quick draft (Q-M4): Medical's create. */
  canAddMedicine: boolean;
  /** "New offering · “q”" on a row's picker — the stacked offering form (L-30e). */
  onNewOffering: (rowIndex: number, query: string) => void;
  /** A picked offering with a live offer: "<offer> applied to <offering>". */
  onPromo: (item: InvoiceCatalogItem) => void;
}

/** The quick line's entry for a catalogue entry — its sub line and price. */
function quickItemOf(
  item: InvoiceCatalogItem,
  catalog: InvoiceCatalog,
): QuickLineItem<InvoiceCatalogItem> {
  return { key: item.key, label: item.label, ...catalog.words(item), data: item };
}

/** The Browse groups (H:5058): All, Often billed, then the catalogue's own groups in order. */
function useBrowseGroups(
  catalog: InvoiceCatalog,
  oftenBilled: readonly InvoiceCatalogItem[],
  medical: boolean,
) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const present = [...new Set(catalog.items.map((item) => item.group))];
  const groupLabel = (group: string) => {
    if (medical) return t(group === 'topical' ? K.browse.topical : K.browse.oral);
    return t(CLINIC_KEYS.offerings.categories[group as OfferingCategory]);
  };
  const order = medical ? ['oral', 'topical'] : present;
  return [
    { id: 'all', label: t(K.browse.all) },
    ...(oftenBilled.length > 0 ? [{ id: 'often', label: t(K.oftenBilled) }] : []),
    ...order
      .filter((group) => present.includes(group as InvoiceCatalogItem['group']))
      .map((group) => ({ id: group, label: groupLabel(group) })),
  ];
}

/** The row's item picker — an offering's or a medicine's — and its free-line fallback. */
function ItemPickerCellOf({
  row,
  form,
  catalog,
  medical,
  readOnly,
  onNewOffering,
  onPromo,
}: {
  row: Parameters<ItemsColumn<InvoiceFormValues, 'items'>['cell']>[0];
  form: UseFormReturn<InvoiceFormValues>;
  catalog: InvoiceCatalog;
  medical: boolean;
  readOnly: boolean;
  onNewOffering: (rowIndex: number, query: string) => void;
  onPromo: (item: InvoiceCatalogItem) => void;
}) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const key = medical ? row.row.medicineId : row.row.offeringId;
  // A row with a name but no catalogue entry (a repeated line whose offering is
  // gone): its name, as billed.
  if (!key && row.row.name.trim() !== '') {
    return <span className="text-body min-w-0 truncate ps-2">{row.row.name}</span>;
  }
  const listed = key ? catalog.byKey.get(key) : undefined;
  const selected: PickerOption<InvoiceCatalogItem>[] =
    key && !listed ? [{ key, label: row.row.name }] : [];
  return (
    <ItemsPickerCell<InvoiceFormValues, InvoiceCatalogItem>
      {...row.bind(medical ? 'medicineId' : 'offeringId', row.label)}
      options={catalog.options}
      selectedOptions={selected}
      placeholder={t(K.pickItem)}
      searchPlaceholder={t(medical ? K.selectMedicine : K.selectOffering)}
      onCreateFull={
        medical || readOnly ? undefined : (query) => onNewOffering(row.index, query)
      }
      createFullLabel={t(K.newOffering)}
      disabled={readOnly}
      minWidth={320}
      onPick={(option) => {
        const item = option?.data;
        if (!item) {
          form.setValue(
            `items.${row.index}`,
            { ...blankLine(), qty: row.row.qty },
            {
              shouldDirty: true,
            },
          );
          return;
        }
        form.setValue(
          `items.${row.index}`,
          { ...lineFromCatalog(item), qty: row.row.qty },
          { shouldDirty: true },
        );
        if (item.promo) onPromo(item);
      }}
    />
  );
}

/** The table's columns (H:5059): Offering · Qty · Rate · Disc % · GST · Final, then the ×. */
function useItemColumns(
  props: InvoiceItemsFieldProps,
): ItemsColumn<InvoiceFormValues, 'items'>[] {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const { form, catalog, readOnly, locked } = props;
  const medical = props.values.type === 'medical';
  const editable = !(readOnly || locked);
  return [
    {
      id: 'item',
      header: t(medical ? K.columns.medicine : K.columns.offering),
      track: 'minmax(0,2.2fr)',
      cell: (row) => (
        <ItemPickerCellOf
          row={row}
          form={form}
          catalog={catalog}
          medical={medical}
          readOnly={!editable}
          onNewOffering={props.onNewOffering}
          onPromo={props.onPromo}
        />
      ),
    },
    {
      id: 'qty',
      header: t(K.columns.qty),
      track: '88px',
      align: 'end',
      cell: (row) => (
        <ItemsQtyCell {...row.bind('qty')} max={INVOICE_QTY_MAX} readOnly={!editable} />
      ),
    },
    {
      id: 'rate',
      header: t(K.columns.rate),
      track: '84px',
      align: 'end',
      cell: (row) => <MoneyCell paise={row.row.rate} />,
    },
    {
      id: 'discount',
      header: t(K.columns.discount),
      track: '64px',
      align: 'end',
      cell: (row) => (
        <ItemsNumberCell
          {...row.bind('discountPct')}
          decimals={2}
          max={100}
          maxLength={6}
          readOnly={!editable}
        />
      ),
    },
    {
      id: 'gst',
      header: t(K.columns.gst),
      track: '52px',
      align: 'end',
      cell: (row) => (
        <span className="text-body text-muted-foreground tabular-nums">
          {row.row.gstPct}%
        </span>
      ),
    },
    {
      id: 'final',
      header: t(K.columns.final),
      track: '100px',
      align: 'end',
      cell: (row) => {
        const named = row.row.name.trim() !== '';
        const floor = named ? props.floorOf(row.row) : null;
        const below = belowFloor(row.row, floor);
        let message: string | undefined;
        if (below && floor !== null) {
          message = props.floorVisible
            ? t(K.belowFloor, {
                amount: formatPaise(Math.round(floor)),
                name: row.row.name,
              })
            : t(K.tooMuchDiscount, { name: row.row.name });
        }
        return (
          <ItemsNumberInput
            money
            label={row.label}
            testId={row.testId}
            value={named ? lineFinal(row.row) : 0}
            readOnly={!(editable && named)}
            error={message}
            onValueChange={(final) =>
              form.setValue(
                `items.${row.index}.discountPct`,
                discountForFinal(row.row, final),
                {
                  shouldDirty: true,
                },
              )
            }
          />
        );
      },
    },
  ];
}

/**
 * A sale's medicine the store lacks (Q-M4; `medical.md:401`, 413): the quick
 * line's "Not in the list · add as typed" and Browse's "New medicine name"
 * add it as a quick Medical draft — MRP ₹0, "Needs MRP and composition" —
 * and bill it on the next blank row. None where the role can't create one.
 */
function useMedicineDraft(
  enabled: boolean,
  add: (item: InvoiceCatalogItem, values: QuickLineTermValues) => void,
): ((name: string, values: QuickLineTermValues) => void) | undefined {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const quickMedicine = useQuickCreateMedicine({
    successMessage: (medicine) => t(K.medicineAdded, { name: medicine.name }),
  });
  if (!enabled) return undefined;
  return (name, values) => {
    void quickMedicine
      .mutateAsync({ name })
      .then((medicine) => add(medicineCatalogItem(medicine), values))
      .catch(() => undefined);
  };
}

/**
 * The Items step (`payments.md:142`; H:5058–5059): the quick line —
 * "lhr face 1 10%" (the shared shorthand, `useQuickLineTerms`), its matches,
 * "Often billed" and Browse, where on a Medical invoice a medicine the store
 * lacks becomes a quick draft (`useMedicineDraft`, Q-M4) — over the item
 * rows: the offering (or medicine) picker with "New offering · “q”"
 * stacking the offering form, the Qty
 * stepper (1–999), the Rate read-only (the effective price, or the MRP), the
 * Disc %, GST read-only (0% on a medicine: its MRP includes it, D45) and the
 * Final, whose typing back-solves the discount and which turns red under the
 * floor — "Below the lowest price ₹4,000 for LHR Full Face · B4G7" for a role
 * that sees floors, else "Too much discount on … · ask an admin".
 */
export function InvoiceItemsField(props: InvoiceItemsFieldProps) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const { form, catalog, oftenBilled, readOnly, locked } = props;
  const medical = props.values.type === 'medical';
  const editable = !(readOnly || locked);
  const rows = (useWatch({ control: form.control, name: 'items' }) ??
    []) as InvoiceLineForm[];
  const columns = useItemColumns(props);
  const groups = useBrowseGroups(catalog, oftenBilled, medical);
  const parse = useQuickLineTerms({
    numbers: nameNumbers(catalog.items.map((item) => item.label)),
    terms: INVOICE_LINE_TERMS,
    max: INVOICE_QTY_MAX,
  });
  const setRows = (next: InvoiceLineForm[]) =>
    form.setValue('items', next, { shouldDirty: true });

  const add = (item: InvoiceCatalogItem, values: QuickLineTermValues) => {
    setRows(withAddedLine(form.getValues('items'), item, values));
    if (item.promo) props.onPromo(item);
  };
  const addMedicine = useMedicineDraft(medical && props.canAddMedicine, add);

  const countOf = (item: QuickLineItem<InvoiceCatalogItem>) =>
    namedLines(rows)
      .filter((row) => (row.offeringId ?? row.medicineId) === item.key)
      .reduce((sum, row) => sum + row.qty, 0);

  const browse: QuickLineBrowseConfig<InvoiceCatalogItem> = {
    groups,
    tiles: (group, words) =>
      catalog.items
        .filter((item) => {
          if (group === 'all') return true;
          if (group === 'often') return oftenBilled.includes(item);
          return item.group === group;
        })
        .filter((item) => quickLineBrowseMatches(item, words))
        .map((item) => quickItemOf(item, catalog)),
    count: countOf,
    added: catalog.items.filter((item) => countOf(quickItemOf(item, catalog)) > 0).length,
    onStep: (item, step) =>
      setRows(withSteppedLine(form.getValues('items'), item.data, step)),
  };

  return (
    <ItemsField
      control={form.control}
      name="items"
      label={t(
        medical ? INVOICE_DRAWER_KEYS.steps.medicines : INVOICE_DRAWER_KEYS.steps.items,
      )}
      columns={columns}
      newRow={() => blankLine()}
      minRows={1}
      addLabel={t(medical ? K.addMedicine : K.addItem)}
      total={<MoneyCell paise={props.total} />}
      totalLabel={t(K.total)}
      readOnly={!editable}
      testId={INVOICE_DRAWER_TEST_IDS.items}
      toolbar={
        editable ? (
          <QuickLine<InvoiceCatalogItem, QuickLineTermValues>
            placeholder={t(medical ? K.quickLineMedical : K.quickLine)}
            hint={t(K.hint)}
            parse={parse}
            matches={(words) =>
              quickLineMatches(catalog.items, words, oftenBilled).map((item) =>
                quickItemOf(item, catalog),
              )
            }
            onPick={add}
            typedName={
              addMedicine
                ? (words) => quickLineTypedName(catalog.items, words)
                : undefined
            }
            onCreate={addMedicine}
            frequent={{
              label: t(K.oftenBilled),
              items: oftenBilled.map((item) => quickItemOf(item, catalog)),
            }}
            browse={{
              ...browse,
              newItem: addMedicine
                ? {
                    placeholder: t(K.newMedicineName),
                    onAdd: (name) => addMedicine(name, {}),
                  }
                : undefined,
            }}
            testId={INVOICE_DRAWER_TEST_IDS.quickLine}
          />
        ) : undefined
      }
    />
  );
}
