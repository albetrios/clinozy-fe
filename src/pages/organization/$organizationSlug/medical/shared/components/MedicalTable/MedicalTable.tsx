import { useTranslation } from 'react-i18next';

import type { MedicalTab } from '@/lib/routes/medical-builders.ts';
import { RoomTable, type RoomTableProps } from '@/shared/components/RoomTable/index.ts';
import {
  type AppIcon,
  Factory,
  Pill,
  Receipt,
  ShoppingCart,
  Truck,
  User,
  Wallet,
} from '@/shared/icons/index.ts';

import {
  MEDICAL_KEYS,
  MEDICAL_NS,
  MEDICAL_TABLE_IDS,
} from '../../../medical.constants.ts';

/** The Medical room's export code (`medicine:export`, research-users §7). */
const MEDICAL_EXPORT_CODE = 'medicine:export';

/** Each tab's own empty-state glyph (change-empty-states R21–R27), in the room's blush. */
const MEDICAL_EMPTY_ICONS: Readonly<Record<MedicalTab, AppIcon>> = {
  sales: Receipt,
  medicines: Pill,
  purchases: ShoppingCart,
  suppliers: Truck,
  manufacturers: Factory,
  mrs: User,
  payments: Wallet,
};

/** Props of {@link MedicalTable}: the shared room table's, named by the tab. */
export interface MedicalTableProps<TRow extends { id: string }> extends Omit<
  RoomTableProps<TRow>,
  'tableId' | 'label' | 'tone' | 'icon' | 'emptyHint' | 'exportCopy' | 'exportCode'
> {
  tab: MedicalTab;
}

/**
 * A Medical tab's table (KICKOFF §6.7 Tables) — the shared room table in the
 * room's blush, the tab's own empty tile (a receipt for Sales, a truck for
 * Suppliers, …; change-empty-states), the tab's table id and name, the
 * room's words for the hint and Export, and Export behind `medicine:export`.
 */
export function MedicalTable<TRow extends { id: string }>({
  tab,
  ...props
}: MedicalTableProps<TRow>) {
  const { t } = useTranslation(MEDICAL_NS);
  const EmptyIcon = MEDICAL_EMPTY_ICONS[tab];
  return (
    <RoomTable
      {...props}
      tableId={MEDICAL_TABLE_IDS[tab]}
      label={t(MEDICAL_KEYS.tabs[tab])}
      tone="blush"
      icon={<EmptyIcon />}
      emptyHint={t(MEDICAL_KEYS.empty.hint)}
      exportCode={MEDICAL_EXPORT_CODE}
      exportCopy={{
        label: t(MEDICAL_KEYS.bulk.export),
        done: (count) => t(MEDICAL_KEYS.bulk.exported, { count }),
      }}
    />
  );
}
