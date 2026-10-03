import { describe, expect, it } from 'vitest';

import {
  buildMetaLine,
  FOLD_RESERVED_WIDTH,
  type FoldColumn,
  foldRank,
  type MetaLineItem,
  naturalRowWidth,
  pickPhoneKeyColumn,
  planFold,
  planPhoneFold,
  primaryColumnIndex,
  rowActionsWidth,
  trackMinWidth,
} from './data-table-fold.ts';

/**
 * The Patients table's default columns (KICKOFF §6.5, H:4696–4705): Gender,
 * Conversion and Age are hidden by default, so they are not visible here.
 */
const PATIENTS: FoldColumn[] = [
  { id: 'id', label: 'ID', track: '64px', kind: 'id' },
  { id: 'patient', label: 'Patient', track: 'minmax(200px,1.4fr)', kind: 'person' },
  { id: 'type', label: 'Type', track: 'minmax(120px,1fr)', kind: 'badges' },
  { id: 'status', label: 'Status', track: '96px', kind: 'badges' },
  { id: 'followUp', label: 'Follow-up', track: '150px', kind: 'badges' },
  { id: 'due', label: 'Due', track: '96px', align: 'end' },
  { id: 'updated', label: 'Updated', track: 'minmax(150px,1fr)' },
  { id: 'actions', label: '', track: '183px', kind: 'actions' },
];

/** The scroller's width inside a card at a viewport width (card margin + border). */
const scrollerAt = (viewport: number, margin: number) => viewport - 2 * margin - 2;

describe('trackMinWidth (H:4098)', () => {
  it.each([
    ['minmax(200px,1.4fr)', 200],
    ['minmax( 96px, 1fr)', 96],
    ['minmax(0,1fr)', 90],
    ['84px', 84],
    ['1fr', 90],
    ['auto', 90],
  ])('%s → %i', (track, width) => {
    expect(trackMinWidth(track)).toBe(width);
  });
});

describe('foldRank (H:4110)', () => {
  it('ranks explicit priority, then amounts, plain, low labels and ids', () => {
    expect(foldRank({ id: 'a', label: 'Amount', track: '96px', priority: 8 })).toBe(2);
    expect(foldRank({ id: 'a', label: 'Due', track: '96px', align: 'end' })).toBe(4);
    expect(foldRank({ id: 'a', label: 'Type', track: '96px' })).toBe(2);
    expect(foldRank({ id: 'a', label: 'Updated', track: '96px' })).toBe(1);
    expect(foldRank({ id: 'a', label: 'Created by', track: '96px' })).toBe(1);
    expect(foldRank({ id: 'a', label: 'E-mail', track: '96px' })).toBe(1);
    expect(foldRank({ id: 'a', label: 'ID', track: '64px', kind: 'id' })).toBe(0);
  });

  it('lets an explicit priority outrank the implicit kinds', () => {
    expect(
      foldRank({ id: 'a', label: 'ID', track: '64px', kind: 'id', priority: 1 }),
    ).toBe(9);
  });
});

describe('primaryColumnIndex (H:4105)', () => {
  it('prefers an explicit primary, then a person, then the first labelled text', () => {
    expect(primaryColumnIndex(PATIENTS)).toBe(1);
    expect(
      primaryColumnIndex([
        { id: 'id', label: 'ID', track: '64px', kind: 'id' },
        { id: 'item', label: 'Item', track: '1fr' },
      ]),
    ).toBe(1);
    expect(
      primaryColumnIndex([
        { id: 'item', label: 'Item', track: '1fr' },
        { id: 'qty', label: 'Qty', track: '1fr', primary: true },
      ]),
    ).toBe(1);
  });
});

describe('planFold — desktop and tablet (H:4099–4114)', () => {
  it('folds nothing when every column fits (Patients at 1440)', () => {
    const plan = planFold(PATIENTS, scrollerAt(1440, 20));
    expect(plan.folded).toEqual([]);
    expect(plan.kept).toEqual(PATIENTS.map((column) => column.id));
    expect(plan.template).toBe(PATIENTS.map((column) => column.track).join(' '));
    expect(plan.spare).toBeGreaterThan(0);
  });

  it('drops ID then Updated at 1024 (KICKOFF §6.5)', () => {
    const plan = planFold(PATIENTS, scrollerAt(1024, 12));
    expect(plan.folded).toEqual(['id', 'updated']);
  });

  it('drops ID, Updated, Follow-up and Status at 820, ties rightmost first', () => {
    const plan = planFold(PATIENTS, scrollerAt(820, 12));
    // The meta line reads in column order on the wide tiers.
    expect(plan.folded).toEqual(['id', 'status', 'followUp', 'updated']);
    expect(plan.kept).toEqual(['patient', 'type', 'due', 'actions']);
  });

  it('breaks rank ties by dropping the rightmost column first', () => {
    const columns: FoldColumn[] = [
      { id: 'name', label: 'Name', track: 'minmax(200px,1fr)' },
      { id: 'left', label: 'Left', track: '100px' },
      { id: 'right', label: 'Right', track: '100px' },
    ];
    // Room for the name and one 100px column only.
    const width = FOLD_RESERVED_WIDTH + 200 + 12 + 100;
    expect(planFold(columns, width).folded).toEqual(['right']);
  });

  it('never folds the primary, the actions or a locked column', () => {
    const columns: FoldColumn[] = [
      { id: 'name', label: 'Name', track: 'minmax(300px,1fr)' },
      { id: 'pinned', label: 'Pinned', track: '200px', locked: true },
      { id: 'other', label: 'Other', track: '200px' },
      { id: 'actions', label: '', track: '120px', kind: 'actions' },
    ];
    const plan = planFold(columns, 100);
    expect(plan.folded).toEqual(['other']);
    expect(plan.kept).toEqual(['name', 'pinned', 'actions']);
  });

  it('relaxes the kept tracks and gives the primary the free width', () => {
    const plan = planFold(PATIENTS, scrollerAt(820, 12));
    expect(plan.template).toBe('minmax(0,1fr) minmax(0,1fr) 96px 183px');
  });

  it('plans no fold before the width is measured', () => {
    expect(planFold(PATIENTS, 0).folded).toEqual([]);
  });
});

describe('naturalRowWidth (H:4100)', () => {
  it('adds the gaps, the row padding and the checkbox track', () => {
    const columns: FoldColumn[] = [
      { id: 'a', label: 'A', track: '100px' },
      { id: 'b', label: 'B', track: 'minmax(150px,1fr)' },
    ];
    expect(naturalRowWidth(columns)).toBe(100 + 150 + 12 + 43);
    expect(naturalRowWidth(columns, 24)).toBe(100 + 150 + 12 + 43 + 24 + 12);
  });
});

describe('pickPhoneKeyColumn (H:4112)', () => {
  it('picks Due on Patients — the end-aligned column ranks highest', () => {
    expect(pickPhoneKeyColumn(PATIENTS)).toBe('due');
  });

  it('lets an explicit priority win over an amount', () => {
    const columns: FoldColumn[] = [
      { id: 'name', label: 'Name', track: '1fr', kind: 'person' },
      { id: 'amount', label: 'Amount', track: '96px', align: 'end' },
      { id: 'status', label: 'Status', track: '96px', priority: 2 },
    ];
    expect(pickPhoneKeyColumn(columns)).toBe('status');
  });

  it('falls back to plain, then low labels, then ids — ties go leftmost', () => {
    const plain: FoldColumn[] = [
      { id: 'name', label: 'Name', track: '1fr', kind: 'person' },
      { id: 'id', label: 'ID', track: '64px', kind: 'id' },
      { id: 'updated', label: 'Updated', track: '96px' },
      { id: 'first', label: 'Branch', track: '96px' },
      { id: 'second', label: 'Room', track: '96px' },
    ];
    expect(pickPhoneKeyColumn(plain)).toBe('first');
    expect(
      pickPhoneKeyColumn(plain.filter((c) => !['first', 'second'].includes(c.id))),
    ).toBe('updated');
    expect(pickPhoneKeyColumn(plain.slice(0, 2))).toBe('id');
  });

  it('has no key when only the primary and actions remain', () => {
    expect(
      pickPhoneKeyColumn([
        { id: 'name', label: 'Name', track: '1fr' },
        { id: 'actions', label: '', track: '72px', kind: 'actions' },
      ]),
    ).toBeNull();
  });
});

describe('planPhoneFold (H:4112)', () => {
  it('keeps the primary, the key and the actions; folds the rest by importance', () => {
    const plan = planPhoneFold(PATIENTS);
    expect(plan.keyId).toBe('due');
    expect(plan.kept).toEqual(['patient', 'due', 'actions']);
    expect(plan.folded).toEqual(['type', 'status', 'followUp', 'updated', 'id']);
  });
});

describe('buildMetaLine (H:4115–4116, H:4125)', () => {
  const item = (columnId: string, label: string, value: string, extra = {}) =>
    ({ columnId, label, value, ...extra }) as MetaLineItem;

  it('skips empty and "—" values on every tier, in plan order', () => {
    const items = [
      item('id', '', '#3508'),
      item('status', 'Status', 'Regular'),
      item('followUp', 'Follow-up', '—'),
      item('updated', 'Updated', '   '),
    ];
    expect(buildMetaLine(items, { phone: false }).map((i) => i.columnId)).toEqual([
      'id',
      'status',
    ]);
  });

  it('caps the phone meta line at four, after skipping the empty ones (Patients)', () => {
    // planPhoneFold order: Type, Status, Follow-up, Updated (folds to nothing), ID.
    const items = [
      item('type', 'Type', 'Aesthetic', { dotClassName: 'bg-tone-lav-dot' }),
      item('status', 'Status', 'Regular'),
      item('followUp', 'Follow-up', 'Sep 24 · 14:50'),
      item('updated', 'Updated', ''),
      item('id', '', '#3508'),
      item('extra', 'Extra', 'One too many'),
    ];
    expect(buildMetaLine(items, { phone: true }).map((i) => i.columnId)).toEqual([
      'type',
      'status',
      'followUp',
      'id',
    ]);
  });

  it('drops "All branches", "Active" and quiet values on a phone only', () => {
    const items = [
      item('branch', 'Branch', 'All branches'),
      item('status', 'Status', 'Active'),
      item('role', 'Role', 'Default', { quiet: true }),
      item('team', 'Team', 'Front desk'),
    ];
    expect(buildMetaLine(items, { phone: true }).map((i) => i.columnId)).toEqual([
      'team',
    ]);
    expect(buildMetaLine(items, { phone: false })).toHaveLength(4);
  });

  it('accepts translated skip values', () => {
    const items = [item('status', 'Estado', 'Activo'), item('team', 'Equipo', 'Caja')];
    expect(
      buildMetaLine(items, { phone: true, skipValues: ['Activo'] }).map((i) => i.value),
    ).toEqual(['Caja']);
  });
});

describe('rowActionsWidth (H:4119)', () => {
  it('sizes Patients’ actions: 183px with Collect, 145px without', () => {
    expect(rowActionsWidth({ inline: 4, separator: true, menu: false }, 32)).toBe(183);
    expect(rowActionsWidth({ inline: 3, separator: true, menu: false }, 32)).toBe(145);
  });

  it('grows with the tablet’s 36px buttons and a "More actions" menu', () => {
    expect(rowActionsWidth({ inline: 2, separator: false, menu: true }, 36)).toBe(
      36 * 2 + 6 + 30 + 6 + 24,
    );
    expect(rowActionsWidth({ inline: 0, separator: false, menu: true }, 32)).toBe(54);
  });

  it('is 0 without actions', () => {
    expect(rowActionsWidth({ inline: 0, separator: false, menu: false }, 32)).toBe(0);
  });
});
