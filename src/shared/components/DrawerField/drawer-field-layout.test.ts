import { describe, expect, it } from 'vitest';

import { type DrawerFieldSlot, layoutDrawerFields } from './drawer-field-layout.ts';

const half: DrawerFieldSlot = { span: 'half' };
const third: DrawerFieldSlot = { span: 'third' };
const full: DrawerFieldSlot = { span: 'full' };
const picker: DrawerFieldSlot = { span: 'half', stretch: false };

describe('layoutDrawerFields — rows of six columns', () => {
  it('maps full / half / third to 6 / 3 / 2 columns when rows fill exactly', () => {
    expect(layoutDrawerFields([full, half, half, third, third, third])).toEqual([
      6, 3, 3, 2, 2, 2,
    ]);
  });

  it('stretches the last field of a row that has room left', () => {
    // First name (half) + Mobile (third): the half takes the free column.
    expect(layoutDrawerFields([half, third])).toEqual([4, 2]);
    expect(layoutDrawerFields([third, half])).toEqual([2, 4]);
    // A half alone in its row fills it.
    expect(layoutDrawerFields([half, full])).toEqual([6, 6]);
  });

  it('starts a new row when a field does not fit', () => {
    expect(layoutDrawerFields([half, third, half])).toEqual([4, 2, 6]);
  });

  it('never stretches a field that opts out — a picker or name stays half', () => {
    expect(layoutDrawerFields([picker])).toEqual([3]);
    expect(layoutDrawerFields([picker, third])).toEqual([3, 3]);
  });

  it('widens a third alone in its row to half, and shares a row of thirds evenly', () => {
    expect(layoutDrawerFields([third])).toEqual([3]);
    expect(layoutDrawerFields([third, third])).toEqual([3, 3]);
  });

  it('handles an empty form', () => {
    expect(layoutDrawerFields([])).toEqual([]);
  });
});
