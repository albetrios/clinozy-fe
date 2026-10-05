import { useTranslation } from 'react-i18next';

import { DrawerField } from '@/shared/components/DrawerField/index.ts';
import { Picker } from '@/shared/components/Picker/index.ts';
import { RoomSearchField } from '@/shared/components/RoomToolbar/RoomSearchField/index.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';

import { ORG_LIST_SORT_PRESETS, type OrgListSortPreset } from './org-list-sort.ts';

const SORT_LABEL_KEYS = SETTINGS_KEYS.panels.listSort;

const SORT_OPTION_LABELS = {
  nameAsc: SORT_LABEL_KEYS.nameAsc,
  nameDesc: SORT_LABEL_KEYS.nameDesc,
  newest: SORT_LABEL_KEYS.newest,
  oldest: SORT_LABEL_KEYS.oldest,
} as const satisfies Record<OrgListSortPreset, string>;

const SORT_OPTIONS = Object.keys(ORG_LIST_SORT_PRESETS) as OrgListSortPreset[];

interface OrgListControlsProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: OrgListSortPreset;
  onSortChange: (value: OrgListSortPreset) => void;
  searchPlaceholder: string;
  searchTestId: string;
  sortTestId: string;
}

/** Search + server-side sort toolbar for organization list panels. */
export function OrgListControls({
  search,
  onSearchChange,
  sort,
  onSortChange,
  searchPlaceholder,
  searchTestId,
  sortTestId,
}: OrgListControlsProps) {
  const { t } = useTranslation(SETTINGS_NS);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <RoomSearchField
        layout="fill"
        value={search}
        onValueChange={onSearchChange}
        placeholder={searchPlaceholder}
        label={searchPlaceholder}
        inputTestId={searchTestId}
        className="max-w-sm flex-1"
      />
      <DrawerField
        label={t(SORT_LABEL_KEYS.label)}
        htmlFor={sortTestId}
        className="w-full sm:w-48"
      >
        <Picker
          id={sortTestId}
          label={t(SORT_LABEL_KEYS.label)}
          value={sort}
          options={SORT_OPTIONS.map((option) => ({
            key: option,
            label: t(SORT_OPTION_LABELS[option]),
          }))}
          plain
          onChange={(key) => {
            if (key) onSortChange(key as OrgListSortPreset);
          }}
          minWidth={180}
          testId={sortTestId}
        />
      </DrawerField>
    </div>
  );
}
