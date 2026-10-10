import { describe, expect, it } from 'vitest';

import { appointmentRow } from '@/tests/utils/appointment-doubles.ts';

import {
  PHOTO_PATIENT_ID,
  photoDouble,
} from '../__tests__/integration/photo-api-double.ts';
import {
  photoAt,
  photoDays,
  photoListParamsOf,
  photoMatchesVisit,
  photoVisitsOf,
} from './photo-view.ts';

const VISIT = 'appt_hydra000000000000000';

describe('photo-view', () => {
  it('reads an album a page of 12 at a time, under the visit filter when there is one', () => {
    expect(photoListParamsOf('general', undefined)).toEqual({
      album: 'general',
      limit: 12,
    });
    expect(photoListParamsOf('lhr', 'none')).toEqual({
      album: 'lhr',
      appointmentId: 'none',
      limit: 12,
    });
  });

  it('says whether the visit filter keeps a photo', () => {
    const filed = photoDouble({ appointmentId: VISIT });
    const loose = photoDouble();
    expect(photoMatchesVisit(filed, undefined)).toBe(true);
    expect(photoMatchesVisit(loose, 'none')).toBe(true);
    expect(photoMatchesVisit(filed, 'none')).toBe(false);
    expect(photoMatchesVisit(filed, VISIT)).toBe(true);
    expect(photoMatchesVisit(loose, VISIT)).toBe(false);
  });

  it('groups the photos by day in the read’s order, with the first one’s service', () => {
    const days = photoDays([
      photoDouble({ id: 'a', takenOn: '2026-09-24', serviceLabel: 'Hydrafacial' }),
      photoDouble({ id: 'b', takenOn: '2026-09-24' }),
      photoDouble({ id: 'c', takenOn: '2026-09-20' }),
    ]);
    expect(days.map((day) => [day.date, day.photos.map((photo) => photo.id)])).toEqual([
      ['2026-09-24', ['a', 'b']],
      ['2026-09-20', ['c']],
    ]);
    expect(days[0]?.serviceLabel).toBe('Hydrafacial');
    expect(days[1]?.serviceLabel).toBeNull();
  });

  it('offers the patient’s checked-in and completed visits, latest first', () => {
    const own = { patientId: PHOTO_PATIENT_ID };
    const visits = photoVisitsOf(
      [
        appointmentRow({ ...own, id: 'appt_a', date: '2026-09-20', status: 'completed' }),
        appointmentRow({
          ...own,
          id: 'appt_b',
          date: '2026-09-24',
          status: 'checked_in',
        }),
        appointmentRow({ ...own, id: 'appt_c', date: '2026-09-28', status: 'scheduled' }),
        appointmentRow({ ...own, id: 'appt_d', date: '2026-09-22', status: 'cancelled' }),
        appointmentRow({ id: 'appt_e', date: '2026-09-25', status: 'completed' }),
      ],
      PHOTO_PATIENT_ID,
    );
    expect(visits.map((visit) => visit.appointmentId)).toEqual(['appt_b', 'appt_a']);
    expect(visits[0]).toEqual({
      appointmentId: 'appt_b',
      seq: 2861,
      date: '2026-09-24',
      serviceLabel: 'Consultation',
      status: 'checked_in',
    });
  });

  it('steps through the photos read, wrapping only once every page is read', () => {
    const list = ['a', 'b', 'c'].map((id) => photoDouble({ id }));
    expect(photoAt(list, 'b', 1, false)?.id).toBe('c');
    expect(photoAt(list, 'b', -1, false)?.id).toBe('a');
    expect(photoAt(list, 'c', 1, false)).toBeNull();
    expect(photoAt(list, 'a', -1, false)).toBeNull();
    expect(photoAt(list, 'c', 1, true)?.id).toBe('a');
    expect(photoAt(list, 'a', -1, true)?.id).toBe('c');
    expect(photoAt(list, 'missing', 1, true)).toBeNull();
  });
});
