import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { personInitials } from '@/shared/components/Cells/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';

import {
  useStockItemCatalogue,
  useStockVendorCatalogue,
} from '../../hooks/useStockLists/index.ts';
import type { OpenStockChild } from '../../hooks/useStockStack/index.ts';
import { useStockWords } from '../../hooks/useStockWords/index.ts';
import type { StockItemRecord, StockVendorRecord } from '../../stock-contracts.ts';
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';
import { fromMilli } from '../../stock-units.ts';

const K = STOCK_DRAWER_KEYS.pickers;

/** The catalogue's rows, then what was just created that it does not list yet. */
function withAdded<T extends { id: string }>(rows: readonly T[], added: readonly T[]) {
  const known = new Set(rows.map((row) => row.id));
  return [...rows, ...added.filter((row) => !known.has(row.id))];
}

/** What every stock picker field takes. */
interface StockPickerFieldProps {
  /** The field's label: the trigger's and the list's accessible name. */
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  /** Opens a stacked child for "New … · “q”" + "full details"; a stacked drawer passes none. */
  openChild?: OpenStockChild;
  id?: string;
  invalid?: boolean;
  'aria-describedby'?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  testId: string;
}

/**
 * The Supplier field of an item and a purchase (`clinic-stock.md:118, 146`):
 * the clinic vendors with their avatar and phone, searched as "Search clinic
 * vendors"; unless the drawer is itself stacked, the footer "New clinic vendor
 * · “q”" + "full details" opens the vendor's own drawer on top, and its save
 * picks the new vendor here.
 */
export function StockVendorPicker({
  label,
  value,
  onChange,
  openChild,
  testId,
  size = 'md',
  ...field
}: StockPickerFieldProps) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const catalogue = useStockVendorCatalogue().data ?? [];
  const [added, setAdded] = useState<StockVendorRecord[]>([]);
  const options: PickerOption[] = withAdded<
    Pick<StockVendorRecord, 'id' | 'name' | 'phone'>
  >(catalogue, added).map((vendor) => ({
    key: vendor.id,
    label: vendor.name,
    sub: vendor.phone ? formatClinicPhone(vendor.phone) : undefined,
    tone: 'sky',
    leading: { kind: 'avatar', initials: personInitials(vendor.name) },
  }));
  return (
    <Picker
      {...field}
      label={label}
      options={options}
      value={value}
      onChange={(id) => onChange(id)}
      placeholder={t(K.searchVendors)}
      searchPlaceholder={t(K.searchVendors)}
      searchable
      size={size}
      onCreateFull={
        openChild
          ? (query) =>
              openChild({
                kind: 'vendor',
                query,
                onCreated: (vendor) => {
                  setAdded((current) => [...current, vendor]);
                  onChange(vendor.id);
                },
              })
          : undefined
      }
      createFullLabel={t(K.newVendor)}
      testId={testId}
    />
  );
}

/** Props of {@link StockItemPicker}. */
export interface StockItemPickerProps extends StockPickerFieldProps {
  /** The purchase's vendor — a new item comes from them. */
  vendorId?: string | null;
}

/**
 * A purchase line's item (`clinic-stock.md:149`): "Select item…", every clinic
 * item with what is in stock ("Gauze swabs · 14 in stock"); the footer "New
 * clinic item · “q”" + "full details" opens the stacked New clinic item, and
 * its save picks the new item on this line.
 */
export function StockItemPicker({
  label,
  value,
  onChange,
  openChild,
  vendorId,
  testId,
  size = 'sm',
  ...field
}: StockItemPickerProps) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const words = useStockWords();
  const catalogue = useStockItemCatalogue().data ?? [];
  const [added, setAdded] = useState<StockItemRecord[]>([]);
  const options: PickerOption[] = withAdded<
    Pick<StockItemRecord, 'id' | 'name' | 'qtyMilli' | 'category'>
  >(catalogue, added).map((item) => ({
    key: item.id,
    label: item.name,
    sub: t(K.inStock, { quantity: words.figure(fromMilli(item.qtyMilli)) }),
    tone: words.category(item.category).tone ?? undefined,
  }));
  return (
    <Picker
      {...field}
      label={label}
      options={options}
      value={value}
      onChange={(id) => onChange(id)}
      placeholder={t(K.selectItem)}
      searchable
      size={size}
      onCreateFull={
        openChild
          ? (query) =>
              openChild({
                kind: 'item',
                query,
                vendorId,
                onCreated: (item) => {
                  setAdded((current) => [...current, item]);
                  onChange(item.id);
                },
              })
          : undefined
      }
      createFullLabel={t(K.newItem)}
      testId={testId}
    />
  );
}
