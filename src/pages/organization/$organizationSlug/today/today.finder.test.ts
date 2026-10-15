import { describe, expect, it } from 'vitest';

import { TODAY_LANES } from '@/shared/api/app/today-contracts.ts';

import { enquiry, floorRow, publicId } from './__tests__/integration/today-fixtures.ts';
import { findOnFloor } from './today.finder.ts';
import { groupTodayLanes } from './today.lanes.ts';

const id = (n: number) => publicId('appt', n);

const LANES = groupTodayLanes(
  [
    floorRow({
      id: id(1),
      name: 'Riya Shah',
      phone: '+919824055123',
      startTime: '10:00',
    }),
    floorRow({
      id: id(2),
      name: 'Supriya Menon',
      phone: '+919811122233',
      status: 'checked_in',
      startTime: '09:30',
    }),
    floorRow({ id: id(3), name: 'Anaya Riya Kapoor', phone: null, startTime: '11:00' }),
    floorRow({
      id: id(4),
      name: 'Ánanya Iyer',
      phone: '+919900011122',
      startTime: '12:00',
    }),
  ],
  [enquiry({ id: publicId('lead', 5), name: 'Riyaan Gupta' })],
);

const find = (query: string, visible = TODAY_LANES) =>
  findOnFloor({ lanes: LANES, visible, query }).map(({ card, range }) => [
    card.name,
    range,
  ]);

describe('findOnFloor (change-today-command-center — the floor finder)', () => {
  it('finds a word of a name from its start — first words before later ones, never mid-word', () => {
    expect(find('riya')).toEqual([
      ['Riyaan Gupta', [0, 4]],
      ['Riya Shah', [0, 4]],
      ['Anaya Riya Kapoor', [6, 10]],
    ]);
    expect(find('  RIYA   sh ')).toEqual([['Riya Shah', [0, 7]]]);
  });

  it('ignores accents and case; a name whose folding changes its length keeps no highlight', () => {
    expect(find('ananya')).toEqual([['Ánanya Iyer', [0, 6]]]);
    // The same name typed with a combining accent: seven code units fold to six.
    const decomposed = groupTodayLanes([floorRow({ name: 'A\u0301nanya Iyer' })], []);
    expect(
      findOnFloor({ lanes: decomposed, visible: TODAY_LANES, query: 'ANANYA' }).map(
        ({ range }) => range,
      ),
    ).toEqual([null]);
  });

  it('finds a booking by three or more digits of its phone', () => {
    expect(find('98240')).toEqual([['Riya Shah', null]]);
    expect(find('+91 98111')).toEqual([['Supriya Menon', null]]);
    // Two digits are not enough to be a phone; an enquiry has no phone here.
    expect(find('98')).toEqual([]);
  });

  it('finds no one for a blank query, nor in a lane the member cannot read', () => {
    expect(find('   ')).toEqual([]);
    expect(find('riya', ['enquiries'])).toEqual([['Riyaan Gupta', [0, 4]]]);
  });
});
