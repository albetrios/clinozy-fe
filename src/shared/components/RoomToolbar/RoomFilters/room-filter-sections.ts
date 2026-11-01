import type { TFunction } from 'i18next';

import { AGE_BANDS } from '@/shared/api/app/app-list-filters.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';

import { AGE_FILTER_KEYS } from '../room-toolbar.constants.ts';
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
 * `section` picking one value at a time — a pick replaces the last, tapping it again clears — for a
 * list the API filters by a single id (a supplier's manufacturer); `null` stays `null`.
 */
export function singlePickSection(
  section: RoomFilterSection | null,
): RoomFilterSection | null {
  if (section?.field.kind !== 'options') return section;
  return { ...section, field: { ...section.field, single: true } };
}

/**
 * The Age section of a list of people (Patients, Leads — feat-approximate-age FE5): one band at a
 * time, "Any" while none is picked; `t` reads the room toolbar's namespace.
 */
export function ageFilterSection(t: TFunction): RoomFilterSection {
  return {
    field: { kind: 'options', values: AGE_BANDS, single: true },
    copy: {
      label: t(AGE_FILTER_KEYS.label),
      anyLabel: t(AGE_FILTER_KEYS.any),
      options: Object.fromEntries(
        AGE_BANDS.map((band) => [band, { label: t(AGE_FILTER_KEYS.bands[band]) }]),
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
