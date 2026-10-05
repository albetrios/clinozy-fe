import { useTranslation } from 'react-i18next';

import type { MedicalTab } from '@/lib/routes/medical-builders.ts';
import { RoomTable, type RoomTableProps } from '@/shared/components/RoomTable/index.ts';
import { Pill } from '@/shared/icons/index.ts';

import {
  MEDICAL_KEYS,
  MEDICAL_NS,
  MEDICAL_TABLE_IDS,
} from '../../../medical.constants.ts';

/** Props of {@link MedicalTable}: the shared room table's, named by the tab. */
export interface MedicalTableProps<TRow extends { id: string }> extends Omit<
  RoomTableProps<TRow>,
  'tableId' | 'label' | 'tone' | 'icon' | 'emptyHint' | 'exportCopy'
> {
  tab: MedicalTab;
}

/**
 * A Medical tab's table (KICKOFF §6.7 Tables) — the shared room table in the
 * room's blush, its `Pill` empty tile, the tab's table id and name, and the
 * room's words for the hint and Export.
 */
export function MedicalTable<TRow extends { id: string }>({
  tab,
  ...props
}: MedicalTableProps<TRow>) {
  const { t } = useTranslation(MEDICAL_NS);
  return (
    <RoomTable
      {...props}
      tableId={MEDICAL_TABLE_IDS[tab]}
      label={t(MEDICAL_KEYS.tabs[tab])}
      tone="blush"
      icon={<Pill />}
      emptyHint={t(MEDICAL_KEYS.empty.hint)}
      exportCopy={{
        label: t(MEDICAL_KEYS.bulk.export),
        done: (count) => t(MEDICAL_KEYS.bulk.exported, { count }),
      }}
    />
  );
}
