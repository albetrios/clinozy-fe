import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import { AGE_BANDS } from '@/shared/api/app/app-list-filters.ts';
import type { RoomFilterFields } from '@/shared/components/RoomToolbar/index.ts';

import { PATIENT_FILTER_VALUES } from './patients.search.ts';

/** The Patients room's i18n namespace. */
export const PATIENTS_NS = I18N_NAMESPACES.patients;

/**
 * The Patients room's copy, verbatim from `patients.md` › Copy (KICKOFF §6.5).
 * The patient enums' labels are the shared clinic vocabulary
 * (`APP_KEYS.patients`); the patient drawer's copy sits beside it.
 */
export const PATIENTS_KEYS = {
  manifest: { title: 'manifest.title' },
  views: {
    /** The view tabs' accessible name. */
    label: 'views.label',
    all: 'views.all',
    follow: 'views.follow',
    recall: 'views.recall',
  },
  search: { placeholder: 'search.placeholder', label: 'search.label' },
  primary: { newPatient: 'primary.newPatient' },
  /** Column headers, also the meta line's labels and the Filters sections'. */
  columns: {
    seq: 'columns.seq',
    name: 'columns.name',
    gender: 'columns.gender',
    types: 'columns.types',
    status: 'columns.status',
    conversion: 'columns.conversion',
    age: 'columns.age',
    followUp: 'columns.followUp',
    updated: 'columns.updated',
  },
  table: {
    /** "All patients loaded" — the plural noun the table's end line names. */
    records: 'table.records',
    /** "28 yrs" — the Age cell (plural). */
    age: 'table.age',
  },
  rowActions: {
    newInvoice: 'rowActions.newInvoice',
    /** Opens the patient's New prescription drawer (feat-prescription-composer §6.2). */
    writePrescription: 'rowActions.writePrescription',
    edit: 'rowActions.edit',
    delete: 'rowActions.delete',
  },
  bulk: {
    export: 'bulk.export',
    /** "3 rows exported as CSV" (plural). */
    exported: 'bulk.exported',
  },
  empty: { title: 'empty.title', description: 'empty.description' },
} as const;

/** The room's table id: the test-id prefix and the device prefs' key (KICKOFF §6.5 Test ids). */
export const PATIENTS_TABLE_ID = 'patients';

/**
 * The Filters popover's fields by URL key, in its section order
 * (`patients.md:119–133`): Type (any number) · Status and Conversion (one each, as the API
 * filters them) · Created and Follow-up date (no "Not set"). Room-only, so it stays out of
 * `patients.search.ts`, which rides the entry chunk.
 */
export const PATIENT_FILTER_FIELDS = {
  types: { kind: 'options', values: PATIENT_FILTER_VALUES.types },
  status: { kind: 'options', values: PATIENT_FILTER_VALUES.status, single: true },
  conversion: {
    kind: 'options',
    values: PATIENT_FILTER_VALUES.conversion,
    single: true,
  },
  age: { kind: 'options', values: AGE_BANDS, single: true },
  created: { kind: 'date', presets: 'created' },
  followUp: { kind: 'date', presets: 'followUp', without: ['not_set'] },
} as const satisfies RoomFilterFields;
