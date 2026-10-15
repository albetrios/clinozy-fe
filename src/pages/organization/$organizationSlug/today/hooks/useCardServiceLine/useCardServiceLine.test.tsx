import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  enquiry,
  floorRow,
  publicId,
} from '../../__tests__/integration/today-fixtures.ts';
import { groupTodayLanes } from '../../today.lanes.ts';
import { useCardServiceLine } from './useCardServiceLine.ts';

function line() {
  return renderHook(() => useCardServiceLine()).result.current;
}

describe('useCardServiceLine — a card’s second line, shared by the panel, Needs you now and the finder', () => {
  it('reads a booking’s service and where: its room, else its doctor, else the service alone', () => {
    const service = line();
    const lanes = groupTodayLanes(
      [
        floorRow({ id: publicId('appt', 1), roomName: 'Room 2' }),
        floorRow({ id: publicId('appt', 2), startTime: '11:30' }),
        floorRow({ id: publicId('appt', 3), startTime: '12:00', doctorName: null }),
      ],
      [],
    );
    expect(lanes.arriving.map(service)).toEqual([
      'Hydrafacial · Room 2',
      'Hydrafacial · Dr. Nisha',
      'Hydrafacial',
    ]);
  });

  it('counts an Rx’s medicines at the pharmacy, and names an enquiry’s interest', () => {
    const service = line();
    const lanes = groupTodayLanes(
      [
        floorRow({
          status: 'checked_in',
          visitStage: 'pharmacy',
          prescription: {
            id: publicId('rx', 1),
            patientId: publicId('pat', 1),
            approvedAt: '2026-10-03T04:35:00.000Z',
            items: 3,
          },
        }),
      ],
      [enquiry(), enquiry({ id: publicId('lead', 2), interests: ['others'] })],
    );
    expect(lanes.pharmacy.map(service)).toEqual(['3 medicines prescribed']);
    expect(lanes.enquiries.map(service)).toEqual(['Clinical', null]);
  });
});
