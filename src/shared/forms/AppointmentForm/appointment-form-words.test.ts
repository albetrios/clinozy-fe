import { describe, expect, it } from 'vitest';

import {
  APPOINTMENT_TOMORROW,
  appointmentRow,
  contactHit,
  DOCTOR_NISHA,
} from '@/tests/utils/appointment-doubles.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';

import { emptyDraft, whoOfContact } from './appointment-form-model.ts';
import {
  cancelReasonText,
  footerSummary,
  formTitle,
  rescheduledText,
  saveLabelText,
} from './appointment-form-words.ts';

/** A `t` that shows the key and its values, so the tests read what was asked. */
const t = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}${JSON.stringify(values)}` : key;

describe('the form’s words', () => {
  it('titles New, Edit and Reschedule — "Appointment" while the booking loads', () => {
    expect(formTitle(t, 'create', undefined)).toBe('appointmentForm.title.create');
    expect(formTitle(t, 'edit', undefined)).toBe('appointmentForm.title.loading');
    expect(formTitle(t, 'edit', appointmentRow())).toBe(
      'appointmentForm.title.edit{"id":"#2861"}',
    );
    expect(formTitle(t, 'reschedule', appointmentRow())).toBe(
      'appointmentForm.title.reschedule{"id":"#2861"}',
    );
  });

  it('sums the booking up in the footer: who · service · length · the doctor’s name', () => {
    const draft = {
      ...emptyDraft(APPOINTMENT_TOMORROW),
      who: whoOfContact(contactHit()),
    };
    // Each part isolated, so a name stays whole on a right-to-left page.
    expect(footerSummary(t, draft, DOCTOR_NISHA)).toBe(
      [
        fsi('Riya Mehta'),
        fsi('Consultation'),
        fsi('appointmentForm.footer.minutes{"minutes":20}'),
        fsi('Nisha Shah'),
      ].join(' · '),
    );
    expect(footerSummary(t, { ...draft, who: null }, undefined)).toBe(
      `${fsi('Consultation')} · ${fsi('appointmentForm.footer.minutes{"minutes":20}')}`,
    );
  });

  it('labels the primary for its kind', () => {
    const slot = { day: 'Mon 5 Oct', time: '10:15 am' };
    expect(saveLabelText(t, 'pickTime', slot)).toBe('appointmentForm.footer.pickTime');
    expect(saveLabelText(t, 'saveChanges', slot)).toBe(
      'appointmentForm.footer.saveChanges',
    );
    expect(saveLabelText(t, 'book', slot)).toBe(
      `appointmentForm.footer.book{"day":"${fsi('Mon 5 Oct')}","time":"${fsi('10:15 am')}"}`,
    );
    expect(saveLabelText(t, 'move', slot)).toBe(
      `appointmentForm.footer.move{"day":"${fsi('Mon 5 Oct')}","time":"${fsi('10:15 am')}"}`,
    );
  });

  it('words the Rescheduled note — asking to confirm again for a Confirmed booking', () => {
    const label = (date: string, time: string) => ({ day: date, time });
    const was = { date: '2026-10-05', time: '10:00', status: 'confirmed' as const };
    expect(rescheduledText(t, null, label)).toBeNull();
    expect(rescheduledText(t, { was, confirmAgain: true }, label)).toBe(
      `appointmentForm.status.rescheduledConfirm{"day":"${fsi('2026-10-05')}","time":"${fsi('10:00')}"}`,
    );
    expect(rescheduledText(t, { was, confirmAgain: false }, label)).toBe(
      `appointmentForm.status.rescheduled{"day":"${fsi('2026-10-05')}","time":"${fsi('10:00')}"}`,
    );
  });

  it('names a cancel’s reason — one of the API’s, or an "Other"’s own note', () => {
    expect(cancelReasonText(t, undefined)).toBeNull();
    expect(cancelReasonText(t, appointmentRow())).toBeNull();
    expect(
      cancelReasonText(
        t,
        appointmentRow({ cancelReason: 'other', cancelNote: 'Moved city' }),
      ),
    ).toBe('Moved city');
    expect(cancelReasonText(t, appointmentRow({ cancelReason: 'other' }))).toBe(
      'appointments.cancelReasons.other{"ns":"app"}',
    );
    expect(cancelReasonText(t, appointmentRow({ cancelReason: 'patient_asked' }))).toBe(
      'appointments.cancelReasons.patient_asked{"ns":"app"}',
    );
    expect(
      cancelReasonText(t, appointmentRow({ cancelReason: 'resource_unavailable' })),
    ).toBe('appointments.cancelReasons.resource_unavailable{"ns":"app"}');
  });
});
