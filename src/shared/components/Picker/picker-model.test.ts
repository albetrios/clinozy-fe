import { describe, expect, it } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';

import type { PickerOption, PickerProps } from './picker.types.ts';
import {
  hasExactLabel,
  isSearchable,
  openingPages,
  pickerCopy,
  pickerEmptyState,
  pickerMode,
  selectedKeysOf,
  toggleKey,
  triggerInset,
} from './picker-model.ts';

const t = i18n.getFixedT('en', 'common');

function options(count: number): PickerOption[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `o${index}`,
    label: `Option ${index}`,
  }));
}

function single(overrides: Partial<PickerProps> = {}): PickerProps {
  return { value: null, onChange: () => {}, ...overrides } as PickerProps;
}

describe('picker model', () => {
  it('reads the mode and the picked keys', () => {
    expect(pickerMode(single())).toBe('single');
    expect(pickerMode(single({ menu: true }))).toBe('menu');
    const multiple: PickerProps = {
      multiple: true,
      value: ['a', 'b'],
      onChange: () => {},
    };
    expect(pickerMode(multiple)).toBe('multiple');
    expect(selectedKeysOf(multiple)).toEqual(['a', 'b']);
    expect(selectedKeysOf(single({ value: 'x' } as Partial<PickerProps>))).toEqual(['x']);
    expect(selectedKeysOf(single())).toEqual([]);
  });

  it('shows the search row for remote data, creatable fields and lists over 7', () => {
    expect(isSearchable(single({ options: options(7) }), false)).toBe(false);
    expect(isSearchable(single({ options: options(8) }), false)).toBe(true);
    expect(isSearchable(single({ options: options(2) }), true)).toBe(true);
    expect(isSearchable(single({ options: options(2), onCreate: () => {} }), false)).toBe(
      true,
    );
    expect(isSearchable(single({ options: options(20), menu: true }), false)).toBe(false);
    expect(isSearchable(single({ options: options(2), searchable: true }), false)).toBe(
      true,
    );
  });

  it('compares the typed text to labels without case', () => {
    expect(hasExactLabel(options(3), 'option 1')).toBe(true);
    expect(hasExactLabel(options(3), 'option')).toBe(false);
    expect(hasExactLabel(options(3), '')).toBe(false);
  });

  it('opens a static single-select list on the page that holds its value', () => {
    expect(openingPages(single({ options: options(100) }))).toBe(1);
    expect(
      openingPages(
        single({ options: options(100), value: 'o10' } as Partial<PickerProps>),
      ),
    ).toBe(1);
    expect(
      openingPages(
        single({ options: options(100), value: 'o40' } as Partial<PickerProps>),
      ),
    ).toBe(2);
    expect(
      openingPages(
        single({ options: options(100), value: 'o89' } as Partial<PickerProps>),
      ),
    ).toBe(4);
  });

  it('toggles a key at the end or out', () => {
    expect(toggleKey(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(toggleKey(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('insets the trigger text 7px beside an avatar, 10px for sm, else 12px', () => {
    expect(triggerInset('md', true)).toBe('avatar');
    expect(triggerInset('sm', false)).toBe('compact');
    expect(triggerInset('lg', false)).toBe('default');
  });

  it('builds the copy from the label and the picks', () => {
    const picked = [{ key: 'd1', label: 'Dr. Mavani' }];
    const copy = pickerCopy(t, 'en', single({ label: 'Doctor' }), picked);
    expect(copy).toEqual({
      placeholder: 'Select…',
      searchPlaceholder: 'Search doctor',
      listLabel: 'Doctor',
      triggerLabel: 'Doctor · Dr. Mavani',
      createFullLabel: 'New doctor',
    });
    const bare = pickerCopy(t, 'en', single(), []);
    expect(bare.searchPlaceholder).toBe('Search');
    expect(bare.listLabel).toBe('Options');
    expect(bare.triggerLabel).toBeUndefined();
    const named = pickerCopy(
      t,
      'en',
      single({
        label: 'Supplier',
        searchPlaceholder: 'Find',
        createFullLabel: 'New supplier',
      }),
      [],
    );
    expect(named.searchPlaceholder).toBe('Find');
    expect(named.createFullLabel).toBe('New supplier');
    expect(named.triggerLabel).toBe('Supplier');
  });

  it('words the empty states (H:3967)', () => {
    expect(pickerEmptyState(t, '', false, undefined)).toEqual({
      title: 'Nothing to pick yet',
    });
    expect(pickerEmptyState(t, '', false, 'No rooms yet')).toEqual({
      title: 'No rooms yet',
    });
    expect(pickerEmptyState(t, 'zz', false, undefined)).toEqual({
      title: 'No results for “zz”',
      hint: 'Check the spelling or try fewer letters',
    });
    expect(pickerEmptyState(t, 'zz', true, undefined).hint).toBe(
      'Try a name, phone number or ID',
    );
  });
});
