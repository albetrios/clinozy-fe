import { describe, expect, it } from 'vitest';

import type {
  AppointmentRow,
  AppointmentStaff,
} from '@/shared/api/clinic/appointments-contracts.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';

import { emptyDraft } from './appointment-form-model.ts';
import {
  cancelReasonText,
  detailsSummaryText,
  footerSummary,
  formTitle,
  rescheduledText,
  saveLabelText,
} from './appointment-form-words.ts';

/** A `t` that shows the key and its values, so the tests read what was asked. */
const t = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}${JSON.stringify(values)}` : key;

const row = (overrides: Partial<AppointmentRow> = {}) =>
  ({ seq: 2861, cancelReason: null, cancelNote: null, ...overrides }) as AppointmentRow;

const doctor = {
  firstName: 'Reenal',
  lastName: 'Shah',
} as AppointmentStaff;

describe('the form’s words', () => {
  it('titles New, Edit and Reschedule — "Appointment" while the booking loads', () => {
    expect(formTitle(t, 'create', undefined)).toBe('appointmentForm.title.create');
    expect(formTitle(t, 'edit', undefined)).toBe('appointmentForm.title.loading');
    expect(formTitle(t, 'edit', row())).toBe('appointmentForm.title.edit{"id":"#2861"}');
    expect(formTitle(t, 'reschedule', row())).toBe(
      'appointmentForm.title.reschedule{"id":"#2861"}',
    );
  });

  it('sums the booking up in the footer: who · service · length · doctor', () => {
    const draft = {
      ...emptyDraft('2026-10-05'),
      who: {
        kind: 'patient' as const,
        name: 'Dharti Galani',
        phone: null,
        patientId: 'p',
        leadId: null,
        seq: 3508,
      },
    };
    // Each part isolated, so a name stays whole on a right-to-left page.
    expect(footerSummary(t, draft, doctor)).toBe(
      [
        fsi('Dharti Galani'),
        fsi('Consultation'),
        fsi('appointmentForm.footer.minutes{"minutes":20}'),
        fsi('Reenal Shah'),
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
  });

  it('sums step 1 up with the reason quoted, cut at 40 characters', () => {
    const draft = { ...emptyDraft(null), reason: ` ${'r'.repeat(50)} ` };
    expect(detailsSummaryText(t, draft, doctor)).toBe(
      [
        fsi('Consultation'),
        fsi('Reenal Shah'),
        fsi('appointmentForm.footer.minutes{"minutes":20}'),
        fsi(`“${'r'.repeat(40)}”`),
      ].join(' · '),
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

  it('names a cancel’s reason — an "Other"’s own note', () => {
    expect(cancelReasonText(t, undefined)).toBeNull();
    expect(cancelReasonText(t, row())).toBeNull();
    expect(
      cancelReasonText(t, row({ cancelReason: 'other', cancelNote: 'Moved city' })),
    ).toBe('Moved city');
    expect(cancelReasonText(t, row({ cancelReason: 'patient_asked' }))).toBe(
      'appointments.cancelReasons.patient_asked{"ns":"clinic"}',
    );
  });
});
