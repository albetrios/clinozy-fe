import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import {
  type RoomFilterCopy,
  type RoomFilterField,
  type RoomFilterFields,
  showsAutomaticSection,
} from '@/shared/components/RoomToolbar/index.ts';

/** A record an automatic section lists: a manufacturer, a supplier, an MR. */
interface SectionRecord {
  id: string;
  name: string;
  tone?: Tone;
}

/** One Filters section: its field (the URL's) and its copy. */
export interface FilterSection {
  field: RoomFilterField;
  copy: RoomFilterCopy;
}

/**
 * An automatic section over records (`medical.md:55–103`): one chip per
 * record, in its tone, picked by id — shown only while 2 to 10 records exist.
 */
export function recordSection(
  label: string,
  records: readonly SectionRecord[],
): FilterSection | null {
  if (!showsAutomaticSection(records.length)) return null;
  return {
    field: { kind: 'options', values: records.map((record) => record.id) },
    copy: {
      label,
      options: Object.fromEntries(
        records.map((record) => [record.id, { label: record.name, tone: record.tone }]),
      ),
    },
  };
}

/**
 * A tab's Filters from its sections, in order — `null` sections (automatic
 * ones that do not qualify) are left out — then Created.
 */
export function filtersOf(sections: Readonly<Record<string, FilterSection | null>>): {
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
