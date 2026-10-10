import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type { ClinicAction } from '@/shared/api/clinic/access-contracts.ts';
import type { Section } from '@/shared/api/clinic/clinic-schema.ts';

/*
 * Roles & access on clinozy-be's permission codes (Q-U-B): a role IS its codes, so every box,
 * Row pill and switch on a role's page is one code — or a row of them — and every change is the
 * role's whole new set (`PUT …/roles/:id/permissions`).
 */

/** A matrix row: one clinozy-be resource, named by its resource. */
type MatrixRowId =
  | 'lead'
  | 'contact'
  | 'contact_activity'
  | 'appointment'
  | 'patient'
  | 'patient_prescription'
  | 'patient_treatment'
  | 'patient_review'
  | 'medicine'
  | 'stock_item'
  | 'payment'
  | 'task'
  | 'offering'
  | 'membership'
  | 'role'
  | 'branch';

/** The rows that are a section's own resource, named as the section. */
type MatrixSectionRowId =
  | 'lead'
  | 'appointment'
  | 'patient'
  | 'medicine'
  | 'stock_item'
  | 'payment'
  | 'task'
  | 'offering'
  | 'membership';

/** The rows that sit under a section's own row, each named in its own words. */
type MatrixSubRowId = Exclude<MatrixRowId, MatrixSectionRowId>;

interface MatrixRowBase {
  /** The clinic section it belongs to: the row's tile and tone. */
  section: Exclude<Section, 'today'>;
  /** Each box's code; null where clinozy-be has none ("—": a review is read with its patient). */
  codes: Readonly<Record<ClinicAction, OrganizationPermission | null>>;
}

/** One row of "What it can see and do": a section's own row, or one under it (`sub`). */
export type MatrixRow =
  | (MatrixRowBase & { id: MatrixSectionRowId; sub: false })
  | (MatrixRowBase & { id: MatrixSubRowId; sub: true });

/** `resource:read|create|update|delete`, with the actions clinozy-be lacks left out. */
function crud(
  resource: string,
  missing: readonly ClinicAction[] = [],
): Record<ClinicAction, OrganizationPermission | null> {
  const code = (action: ClinicAction, verb: string) =>
    missing.includes(action) ? null : (`${resource}:${verb}` as OrganizationPermission);
  return {
    view: code('view', 'read'),
    create: code('create', 'create'),
    edit: code('edit', 'update'),
    delete: code('delete', 'delete'),
  };
}

/** The matrix's rows in the room's order: each section's own resource, then the ones under it. */
export const MATRIX_ROWS: readonly MatrixRow[] = [
  { id: 'lead', section: 'leads', sub: false, codes: crud('lead') },
  { id: 'contact', section: 'leads', sub: true, codes: crud('contact') },
  {
    id: 'contact_activity',
    section: 'leads',
    sub: true,
    codes: crud('contact_activity'),
  },
  { id: 'appointment', section: 'appointments', sub: false, codes: crud('appointment') },
  { id: 'patient', section: 'patients', sub: false, codes: crud('patient') },
  {
    id: 'patient_prescription',
    section: 'patients',
    sub: true,
    codes: crud('patient_prescription'),
  },
  {
    id: 'patient_treatment',
    section: 'patients',
    sub: true,
    codes: crud('patient_treatment', ['delete']),
  },
  {
    id: 'patient_review',
    section: 'patients',
    sub: true,
    codes: crud('patient_review', ['view']),
  },
  { id: 'medicine', section: 'medical', sub: false, codes: crud('medicine') },
  { id: 'stock_item', section: 'stock', sub: false, codes: crud('stock_item') },
  { id: 'payment', section: 'payments', sub: false, codes: crud('payment') },
  { id: 'task', section: 'tasks', sub: false, codes: crud('task') },
  // Every member reads the catalogue (`organization:read`); the row writes it.
  { id: 'offering', section: 'offerings', sub: false, codes: crud('offering', ['view']) },
  { id: 'membership', section: 'users', sub: false, codes: crud('membership') },
  { id: 'role', section: 'users', sub: true, codes: crud('role') },
  { id: 'branch', section: 'users', sub: true, codes: crud('branch') },
];

/** One special permission: a code no box holds, as a switch. */
export interface SpecialPermission {
  code: OrganizationPermission;
  /** An export names its section ("Export · Leads"); the rest have their own words. */
  kind: 'export' | 'floor' | 'clinical' | 'privateAlbum';
  section: Exclude<Section, 'today'>;
}

/** "Special permissions": each section's export, then the three reads beyond a box. */
export const SPECIAL_PERMISSIONS: readonly SpecialPermission[] = [
  { code: 'lead:export', kind: 'export', section: 'leads' },
  { code: 'appointment:export', kind: 'export', section: 'appointments' },
  { code: 'patient:export', kind: 'export', section: 'patients' },
  { code: 'medicine:export', kind: 'export', section: 'medical' },
  { code: 'stock_item:export', kind: 'export', section: 'stock' },
  { code: 'payment:export', kind: 'export', section: 'payments' },
  { code: 'task:export', kind: 'export', section: 'tasks' },
  { code: 'offering:export', kind: 'export', section: 'offerings' },
  { code: 'offering:lower_price:read', kind: 'floor', section: 'offerings' },
  { code: 'patient:clinical_record:read', kind: 'clinical', section: 'patients' },
  { code: 'patient:private_album:read', kind: 'privateAlbum', section: 'patients' },
];

/** The codes a box or a special switch holds — every other code is a workspace permission. */
export const CLINIC_PERMISSION_CODES: ReadonlySet<string> = new Set([
  ...MATRIX_ROWS.flatMap((row) =>
    Object.values(row.codes).filter((code) => code !== null),
  ),
  ...SPECIAL_PERMISSIONS.map((special) => special.code),
]);

/** A row's codes, its "—" boxes left out. */
function rowCodes(row: MatrixRow): OrganizationPermission[] {
  return Object.values(row.codes).filter(
    (code): code is OrganizationPermission => code !== null,
  );
}

/** The Row pill: every box on, none, or some. */
export function rowState(
  row: MatrixRow,
  held: ReadonlySet<string>,
): 'full' | 'some' | 'none' {
  const codes = rowCodes(row);
  const on = codes.filter((code) => held.has(code)).length;
  if (on === 0) return 'none';
  return on === codes.length ? 'full' : 'some';
}

/**
 * The role's codes with one box flipped. Create, Edit or Delete bring View along (nothing is
 * written blind), and View off takes the row with it.
 */
export function withBoxToggled(
  codes: readonly string[],
  row: MatrixRow,
  action: ClinicAction,
): string[] {
  const code = row.codes[action];
  if (!code) return [...codes];
  const held = new Set(codes);
  if (held.has(code)) {
    for (const each of action === 'view' ? rowCodes(row) : [code]) held.delete(each);
  } else {
    held.add(code);
    if (row.codes.view) held.add(row.codes.view);
  }
  return [...held];
}

/** The role's codes with a whole row on — or off, when it is already full. */
export function withRowToggled(codes: readonly string[], row: MatrixRow): string[] {
  const held = new Set(codes);
  const full = rowState(row, held) === 'full';
  for (const code of rowCodes(row)) {
    if (full) held.delete(code);
    else held.add(code);
  }
  return [...held];
}

/** The role's codes with one code on or off (a special or a workspace switch). */
export function withCodeToggled(codes: readonly string[], code: string): string[] {
  return codes.includes(code) ? codes.filter((held) => held !== code) : [...codes, code];
}
