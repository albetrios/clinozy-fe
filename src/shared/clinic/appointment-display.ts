import type {
  AppointmentPerson,
  AppointmentRow,
} from '@/shared/api/clinic/appointments-contracts.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { AppointmentType, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type { ContactCardData } from '@/shared/components/PersonCard/index.ts';

/*
 * How every surface paints and names a booking — the Appointments room's
 * views and card, and the appointment form wherever it is stacked (KICKOFF
 * §6.4): the service tone and the person as the contact card reads them. A
 * doctor's name is `personFullName` (the Cells' name helpers). Pure.
 */

/**
 * Each type's tone (`AP_TYPE`, H:3418): Consultation sky, Follow-up mint,
 * Treatment sage, Package session lav, Other stone — the form's type chips,
 * and the tone of a service the design does not name.
 */
export const APPOINTMENT_TYPE_TONES: Readonly<Record<AppointmentType, Tone>> = {
  consultation: 'sky',
  follow_up: 'mint',
  treatment: 'sage',
  package_session: 'lav',
  other: 'stone',
};

/**
 * The services the design names, by label (`AP_SVC`, H:3416): Consultation
 * sky, Follow-up mint, Treatment sage, LHR Treatment lav, Peel blush,
 * Hydrafacial mint, Other stone.
 */
const SERVICE_TONES: Readonly<Record<string, Tone>> = {
  consultation: 'sky',
  'follow-up': 'mint',
  treatment: 'sage',
  'lhr treatment': 'lav',
  peel: 'blush',
  hydrafacial: 'mint',
  other: 'stone',
};

/** A booking's service tone: the design's for its label, else its type's. */
export function serviceTone(
  appointment: Pick<AppointmentRow, 'serviceLabel' | 'type'>,
): Tone {
  return (
    SERVICE_TONES[appointment.serviceLabel.trim().toLowerCase()] ??
    APPOINTMENT_TYPE_TONES[appointment.type]
  );
}

/** The booked person as the contact card reads them (D32 — a patient, a lead or a contact thread). */
export function appointmentContactCard(person: AppointmentPerson): ContactCardData {
  let id: string | null = null;
  if (person.seq !== null) {
    id =
      person.kind === 'patient'
        ? displayId.patient(person.seq)
        : displayId.lead(person.seq);
  }
  return {
    kind: person.kind,
    name: person.name,
    displayId: id,
    reach: person.phone ? [{ channel: 'whatsapp', phone: person.phone }] : [],
  };
}
