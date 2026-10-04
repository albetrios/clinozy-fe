import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';

import {
  type RoomFilterField,
  type RoomFilterFields,
  showsAutomaticSection,
} from './room-filters.ts';
import type { RoomFilterCopy } from './RoomFilters.tsx';

/** One Filters section of a room's list: its field (the URL's) and its copy. */
export interface RoomFilterSection {
  field: RoomFilterField;
  copy: RoomFilterCopy;
}

/** A value an automatic section lists: a manufacturer, a category, a runway. */
export interface AutomaticSectionValue {
  /** The value the URL holds — a record id or a machine value. */
  id: string;
  name: string;
  tone?: Tone;
}

/**
 * An automatic section (`_patterns.md` Filters; KICKOFF §6.7–§6.8): one chip
 * per value, in its tone, picked by id — shown only while it holds 2 to 10
 * values and, given the list's `rows`, fewer values than rows (a section with
 * a value per row filters nothing a search would not).
 */
export function automaticSection(
  label: string,
  values: readonly AutomaticSectionValue[],
  rows?: number,
): RoomFilterSection | null {
  if (!showsAutomaticSection(values.length)) return null;
  if (rows !== undefined && values.length >= rows) return null;
  return {
    field: { kind: 'options', values: values.map((value) => value.id) },
    copy: {
      label,
      options: Object.fromEntries(
        values.map((value) => [value.id, { label: value.name, tone: value.tone }]),
      ),
    },
  };
}

/**
 * A room tab's Filters from its sections, in order — `null` sections (automatic
 * ones that do not qualify) are left out — then Created.
 */
export function roomFiltersOf(
  sections: Readonly<Record<string, RoomFilterSection | null>>,
): {
  fields: RoomFilterFields;
  copy: Readonly<Record<string, RoomFilterCopy>>;
} {
  const kept = Object.entries(sections).flatMap(([key, section]) =>
    section ? [[key, section] as const] : [],
  );
  return {
    fields: {
      ...Object.fromEntries(kept.map(([key, section]) => [key, section.field])),
      created: { kind: 'date', presets: 'created' },
    },
    copy: Object.fromEntries(kept.map(([key, section]) => [key, section.copy])),
  };
}
