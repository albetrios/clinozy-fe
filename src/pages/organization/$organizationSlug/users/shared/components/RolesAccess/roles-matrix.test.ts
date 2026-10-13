import { describe, expect, it } from 'vitest';

import {
  APP_PERMISSION_CODES,
  MATRIX_ROWS,
  type MatrixRow,
  rowState,
  SPECIAL_PERMISSIONS,
  withBoxToggled,
  withCodeToggled,
  withRowToggled,
} from './roles-matrix.ts';

const rowOf = (id: MatrixRow['id']): MatrixRow => {
  const row = MATRIX_ROWS.find((candidate) => candidate.id === id);
  if (!row) throw new Error(`no matrix row ${id}`);
  return row;
};

const sorted = (codes: readonly string[]) => [...codes].sort();

describe('the matrix’s rows — every box is one clinozy-be code', () => {
  it('maps the four actions to read / create / update / delete', () => {
    expect(rowOf('lead').codes).toEqual({
      view: 'lead:read',
      create: 'lead:create',
      edit: 'lead:update',
      delete: 'lead:delete',
    });
  });

  it('leaves out the codes clinozy-be lacks: a treatment’s delete, a review’s and an offering’s read', () => {
    expect(rowOf('patient_treatment').codes.delete).toBeNull();
    expect(rowOf('patient_review').codes.view).toBeNull();
    expect(rowOf('offering').codes.view).toBeNull();
  });

  it('holds every box code and special switch — and no workspace code', () => {
    expect(APP_PERMISSION_CODES.has('lead:read')).toBe(true);
    expect(APP_PERMISSION_CODES.has('offering:lower_price:read')).toBe(true);
    expect(APP_PERMISSION_CODES.has('patient:private_album:read')).toBe(true);
    // The rows' "—" leave no code behind.
    expect(APP_PERMISSION_CODES.has('patient_treatment:delete')).toBe(false);
    expect(APP_PERMISSION_CODES.has('offering:read')).toBe(false);
    expect(APP_PERMISSION_CODES.has('api-key:manage')).toBe(false);
    expect(APP_PERMISSION_CODES.has('audit-log:read')).toBe(false);
  });

  it('lists one export per section and three reads beyond a box', () => {
    const exports = SPECIAL_PERMISSIONS.filter((special) => special.kind === 'export');
    expect(new Set(exports.map((special) => special.section)).size).toBe(exports.length);
    expect(
      SPECIAL_PERMISSIONS.filter((special) => special.kind !== 'export').map(
        (special) => special.code,
      ),
    ).toEqual([
      'offering:lower_price:read',
      'patient:clinical_record:read',
      'patient:private_album:read',
    ]);
  });
});

describe('rowState — the Row pill', () => {
  const lead = rowOf('lead');

  it('reads none, some and full — over the row’s own codes only', () => {
    expect(rowState(lead, new Set())).toBe('none');
    expect(rowState(lead, new Set(['contact:read', 'lead:export']))).toBe('none');
    expect(rowState(lead, new Set(['lead:read']))).toBe('some');
    expect(
      rowState(lead, new Set(['lead:read', 'lead:create', 'lead:update', 'lead:delete'])),
    ).toBe('full');
  });

  it('counts a row with a "—" box full once its real boxes are on', () => {
    expect(
      rowState(
        rowOf('patient_treatment'),
        new Set([
          'patient_treatment:read',
          'patient_treatment:create',
          'patient_treatment:update',
        ]),
      ),
    ).toBe('full');
  });
});

describe('withBoxToggled — one box, never a write blind', () => {
  const lead = rowOf('lead');

  it('brings View along with Create, Edit or Delete', () => {
    expect(sorted(withBoxToggled([], lead, 'create'))).toEqual([
      'lead:create',
      'lead:read',
    ]);
    expect(sorted(withBoxToggled(['task:read'], lead, 'delete'))).toEqual([
      'lead:delete',
      'lead:read',
      'task:read',
    ]);
  });

  it('turns one write off and keeps the rest of the row', () => {
    expect(
      sorted(withBoxToggled(['lead:read', 'lead:create', 'lead:update'], lead, 'create')),
    ).toEqual(['lead:read', 'lead:update']);
  });

  it('takes the whole row with View off — and nothing of any other row', () => {
    expect(
      withBoxToggled(
        ['lead:read', 'lead:create', 'lead:delete', 'contact:read', 'lead:export'],
        lead,
        'view',
      ),
    ).toEqual(['contact:read', 'lead:export']);
  });

  it('changes nothing for a "—" box, and adds no View a row lacks', () => {
    const treatment = rowOf('patient_treatment');
    expect(withBoxToggled(['patient_treatment:read'], treatment, 'delete')).toEqual([
      'patient_treatment:read',
    ]);
    // A review is read with its patient: creating one brings no read of its own.
    expect(withBoxToggled([], rowOf('patient_review'), 'create')).toEqual([
      'patient_review:create',
    ]);
  });

  it('never repeats a code already held', () => {
    const codes = withBoxToggled(['lead:read'], lead, 'edit');
    expect(codes.filter((code) => code === 'lead:read')).toHaveLength(1);
  });
});

describe('withRowToggled — the Row pill’s click', () => {
  it('turns every box on from none or some, and every box off from full', () => {
    const lead = rowOf('lead');
    const full = ['lead:read', 'lead:create', 'lead:update', 'lead:delete'];
    expect(sorted(withRowToggled([], lead))).toEqual(sorted(full));
    expect(sorted(withRowToggled(['lead:update', 'task:read'], lead))).toEqual(
      sorted([...full, 'task:read']),
    );
    expect(withRowToggled([...full, 'task:read'], lead)).toEqual(['task:read']);
  });

  it('turns on only the boxes a row has', () => {
    expect(sorted(withRowToggled([], rowOf('offering')))).toEqual([
      'offering:create',
      'offering:delete',
      'offering:update',
    ]);
  });
});

describe('withCodeToggled — a special or workspace switch', () => {
  it('adds a code missing and removes one held, leaving the rest in order', () => {
    expect(withCodeToggled(['lead:read'], 'lead:export')).toEqual([
      'lead:read',
      'lead:export',
    ]);
    expect(withCodeToggled(['lead:export', 'lead:read'], 'lead:export')).toEqual([
      'lead:read',
    ]);
    expect(withCodeToggled([], 'api-key:manage')).toEqual(['api-key:manage']);
  });
});
