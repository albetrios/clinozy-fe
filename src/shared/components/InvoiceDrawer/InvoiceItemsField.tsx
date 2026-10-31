import { type UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { OfferingCategory } from '@/shared/api/app/app-schema.ts';
import {
  INVOICE_LINE_DESCRIPTION_MAX,
  INVOICE_QTY_MAX,
} from '@/shared/api/app/invoices-contracts.ts';
import { APP_KEYS } from '@/shared/app/app.constants.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
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
import { useMedicineUnits } from '@/shared/hooks/useMedicineUnits/index.ts';

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

/**
 * What a line reads: "2 = qty · 10% = discount" — the server sets the rate (B9), a sale's too
 * (MD19: no typed rate; the design's "@500 = rate", `payments.md:140`, goes).
 */
const LINE_TERMS: readonly QuickLineTerm[] = ['qty', 'discount'];

/** What a row's read-only cells show — in paise, null while not known — and why it is refused. */
export interface InvoiceRowFigures {
  /** The rate per unit. */
  rate: number | null;
  gstPct: number | null;
  /** What the line comes to. */
  final: number | null;
  /** The live offers that priced it, by name. */
  offers: readonly string[];
  /** The figures answer an older form of the row: a new preview is on its way. */
  stale: boolean;
  /** Why the server refuses the row — under its lowest price. */
  error?: string;
}

/** Props of {@link InvoiceItemsField}. */
export interface InvoiceItemsFieldProps {
  form: UseFormReturn<InvoiceFormValues>;
  values: InvoiceFormValues;
  catalog: InvoiceCatalog;
  /**
   * A row's Rate, GST and Final — an invoice's from the server's preview, a sale's from the
   * drawer's own sums at MRP (the server prices the sale).
   */
  rowFigures: (row: InvoiceLineForm, index: number) => InvoiceRowFigures;
  /** A Final typed on a row: the discount that brings the line to it (paise). */
  onFinal: (index: number, final: number) => void;
  /** The bill the table's footer shows (H:5059). */
  total: number;
  readOnly: boolean;
  /** A saved invoice's lines that never change here — a Medical sale's (`S:51`). */
  locked: boolean;
  /** A medicine the store lacks may become a quick draft (Q-M4): Medical's create. */
  canAddMedicine: boolean;
  /**
   * "New offering · “q”" on a row's picker — the stacked offering form (L-30e); none without
   * `offering:create`.
   */
  onNewOffering?: (rowIndex: number, query: string) => void;
}

/** The quick line's entry for a catalogue entry — its sub line and price. */
function quickItemOf(
  item: InvoiceCatalogItem,
  catalog: InvoiceCatalog,
): QuickLineItem<InvoiceCatalogItem> {
  return { key: item.key, label: item.label, ...catalog.words(item), data: item };
}

/**
 * The Browse groups (H:5058): All, then the catalogue's own groups in order — the design's
 * "Often billed" has no clinozy-be read (G-P6) and is not drawn.
 */
function useBrowseGroups(catalog: InvoiceCatalog, medical: boolean) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const present = [...new Set(catalog.items.map((item) => item.group))];
  const groupLabel = (group: string) => {
    if (medical) return t(group === 'topical' ? K.browse.topical : K.browse.oral);
    return t(APP_KEYS.offerings.categories[group as OfferingCategory]);
  };
  const order = medical ? ['oral', 'topical'] : present;
  return [
    { id: 'all', label: t(K.browse.all) },
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
}: {
  row: Parameters<ItemsColumn<InvoiceFormValues, 'items'>['cell']>[0];
  form: UseFormReturn<InvoiceFormValues>;
  catalog: InvoiceCatalog;
  medical: boolean;
  readOnly: boolean;
  onNewOffering?: (rowIndex: number, query: string) => void;
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
        medical || readOnly || !onNewOffering
          ? undefined
          : (query) => onNewOffering(row.index, query)
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
      }}
    />
  );
}

/** What the table's columns read. */
type ItemColumnsProps = Omit<InvoiceItemsFieldProps, 'total' | 'canAddMedicine'>;

/** A figure the row does not know yet: "—". */
const NO_FIGURE = '—';

/**
 * The Rate cell: the rate per unit — on an invoice the server's, its live offer named beside it
 * (a sage dot; the name spoken and on hover) — dimmed while a new preview is on its way.
 */
function RateCell({ figures }: { figures: InvoiceRowFigures }) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  if (figures.rate === null) {
    return <span className="text-body text-muted-foreground">{NO_FIGURE}</span>;
  }
  const offers = figures.offers.join(', ');
  return (
    <span
      className={cn(
        'text-body inline-flex items-center gap-1 tabular-nums',
        figures.stale && 'opacity-60',
      )}
      title={offers || undefined}
    >
      {offers ? (
        <>
          <span
            aria-hidden="true"
            data-slot="pill"
            className={cn('size-1.5 flex-none rounded-full', TONE_CLASSES.sage.fill)}
          />
          <span className="sr-only">{t(K.offerApplied, { offer: offers })}</span>
        </>
      ) : null}
      <MoneyCell paise={figures.rate} />
    </span>
  );
}

/**
 * Under a loose-selling medicine's quantity, the units as packs — "= 1 pack + 2"
 * (change-pharmacy-record-fields D5): the quantity counts tablets or strips, the stock too.
 */
function PackEquivalent({
  catalog,
  medicineId,
  qty,
}: {
  catalog: InvoiceCatalog;
  medicineId: string | null;
  qty: number;
}) {
  const units = useMedicineUnits();
  const unitsPerPack = medicineId
    ? (catalog.byKey.get(medicineId)?.unitsPerPack ?? 1)
    : 1;
  const equal = units.packEquivalent(qty, unitsPerPack);
  if (equal === null) return null;
  return (
    <span
      className="text-caption text-muted-foreground block"
      data-testid="invoice-line-packs"
    >
      {equal}
    </span>
  );
}

/** The table's columns (H:5059): Offering · Qty · Rate · Disc % · GST · Final, then the ×. */
function useItemColumns({
  form,
  values,
  catalog,
  rowFigures,
  onFinal,
  readOnly,
  locked,
  onNewOffering,
}: ItemColumnsProps): ItemsColumn<InvoiceFormValues, 'items'>[] {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const medical = values.type === 'medical';
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
          onNewOffering={onNewOffering}
        />
      ),
    },
    {
      id: 'qty',
      header: t(K.columns.qty),
      track: '88px',
      align: 'end',
      cell: (row) => (
        <>
          <ItemsQtyCell {...row.bind('qty')} max={INVOICE_QTY_MAX} readOnly={!editable} />
          <PackEquivalent
            catalog={catalog}
            medicineId={row.row.medicineId}
            qty={row.row.qty}
          />
        </>
      ),
    },
    {
      id: 'rate',
      header: t(K.columns.rate),
      track: '84px',
      align: 'end',
      cell: (row) => <RateCell figures={rowFigures(row.row, row.index)} />,
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
      cell: (row) => {
        const { gstPct } = rowFigures(row.row, row.index);
        return (
          <span className="text-body text-muted-foreground tabular-nums">
            {gstPct === null ? NO_FIGURE : `${gstPct}%`}
          </span>
        );
      },
    },
    {
      id: 'final',
      header: t(K.columns.final),
      track: '100px',
      align: 'end',
      cell: (row) => {
        const figures = rowFigures(row.row, row.index);
        const named = row.row.name.trim() !== '';
        return (
          <ItemsNumberInput
            money
            label={row.label}
            testId={row.testId}
            value={named ? (figures.final ?? 0) : 0}
            readOnly={!(editable && named && figures.final !== null)}
            error={figures.error}
            className={figures.stale ? 'opacity-60' : undefined}
            onValueChange={(final) => onFinal(row.index, final)}
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
 * "lhr face 1 10%" (the shared shorthand, `useQuickLineTerms`), its matches
 * and Browse, where on a Medical sale a medicine the store
 * lacks becomes a quick draft (`useMedicineDraft`, Q-M4) — over the item
 * rows: the offering (or medicine) picker with "New offering · “q”"
 * stacking the offering form, the Qty
 * stepper (1–999), the Rate read-only (the effective price, or the MRP), the
 * Disc %, GST read-only (0% on a medicine: its MRP includes it, D45) and the
 * Final, whose typing back-solves the discount and which turns red under the
 * floor — "Below the lowest price ₹4,000 for LHR Full Face · B4G7" for a role
 * that sees floors, else "Too much discount on … · ask an admin". Under each
 * row a dashed Description line takes the free text the bill prints under the
 * line's name (up to 280).
 */
export function InvoiceItemsField({
  form,
  values,
  catalog,
  rowFigures,
  onFinal,
  total,
  readOnly,
  locked,
  canAddMedicine,
  onNewOffering,
}: InvoiceItemsFieldProps) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const medical = values.type === 'medical';
  const editable = !(readOnly || locked);
  const rows = useWatch({ control: form.control, name: 'items' }) ?? [];
  const columns = useItemColumns({
    form,
    values,
    catalog,
    rowFigures,
    onFinal,
    readOnly,
    locked,
    onNewOffering,
  });
  const groups = useBrowseGroups(catalog, medical);
  const parse = useQuickLineTerms({
    numbers: nameNumbers(catalog.items.map((item) => item.label)),
    terms: LINE_TERMS,
    max: INVOICE_QTY_MAX,
  });
  const setRows = (next: InvoiceLineForm[]) =>
    form.setValue('items', next, { shouldDirty: true });

  const add = (item: InvoiceCatalogItem, values: QuickLineTermValues) => {
    setRows(withAddedLine(form.getValues('items'), item, values));
  };
  const addMedicine = useMedicineDraft(medical && canAddMedicine, add);

  const countOf = (item: QuickLineItem<InvoiceCatalogItem>) =>
    namedLines(rows)
      .filter((row) => (row.offeringId ?? row.medicineId) === item.key)
      .reduce((sum, row) => sum + row.qty, 0);

  const browse: QuickLineBrowseConfig<InvoiceCatalogItem> = {
    groups,
    tiles: (group, words) =>
      catalog.items
        .filter((item) => group === 'all' || item.group === group)
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
      total={<MoneyCell paise={total} />}
      totalLabel={t(K.total)}
      readOnly={!editable}
      note={
        // A view shows the line only when a row has a description to read.
        editable || rows.some((row) => row.description.trim() !== '')
          ? {
              key: 'description',
              tag: t(K.description),
              placeholder: t(K.descriptionPlaceholder),
              maxLength: INVOICE_LINE_DESCRIPTION_MAX,
            }
          : undefined
      }
      testId={INVOICE_DRAWER_TEST_IDS.items}
      toolbar={
        editable ? (
          <QuickLine<InvoiceCatalogItem, QuickLineTermValues>
            placeholder={t(medical ? K.quickLineMedical : K.quickLine)}
            hint={t(K.hintInvoice)}
            parse={parse}
            matches={(words) =>
              quickLineMatches(catalog.items, words).map((item) =>
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
