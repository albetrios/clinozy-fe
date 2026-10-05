import { useTranslation } from 'react-i18next';

import type { Appointment, Treatment } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicClockTime, clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import type { TaskDetail, TaskStaff } from '@/shared/api/clinic/tasks-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { personFullName, shortPersonName } from '@/shared/components/Cells/index.ts';
import { useTaskDayTimeWords } from '@/shared/hooks/useTaskDueLabel/index.ts';

import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';

/** A context tile's label key. */
type TaskContextTileKey = keyof typeof TASKS_KEYS.drawer.tiles;

/** One context tile: its label and its value ("—" when the record has none). */
export interface TaskContextTile {
  key: TaskContextTileKey;
  label: string;
  value: string;
}

const NONE = '—';

/** The lead the tiles read: the task's source lead, else the person's own (not a chat-only thread). */
export function taskContextLead(detail: TaskDetail): LeadRecord | null {
  if (detail.source?.kind === 'lead') return detail.source.lead;
  const thread = detail.thread;
  return thread && !thread.isContactThread ? thread : null;
}

/**
 * The context tiles (`tasks.md` › Task drawer › 3): a visit's "Visit · Service
 * · Doctor · Status"; a treatment's "Treatment · Done on · Session ·
 * Therapist"; a lead's — the task's, or the person's — "Status · Source ·
 * Interested in · Owner · Mobile". A label already shown keeps its first
 * value; a patient-only task has none.
 */
export function useTaskContextTiles(detail: TaskDetail, now: Date): TaskContextTile[] {
  const { t } = useTranslation(TASKS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const dayTime = useTaskDayTimeWords();
  const tiles: TaskContextTile[] = [];
  const add = (key: TaskContextTileKey, value: string | null | undefined) => {
    if (tiles.some((tile) => tile.key === key)) return;
    tiles.push({ key, label: t(TASKS_KEYS.drawer.tiles[key]), value: value || NONE });
  };
  const named = (id: string | null) => {
    const staff = id ? detail.staff.find((member: TaskStaff) => member.id === id) : null;
    return staff ? shortPersonName(personFullName(staff)) : null;
  };

  const visit = (appointment: Appointment) => {
    const words = dayTime(appointment.date, appointment.startTime, now);
    add(
      'visit',
      t(TASKS_KEYS.drawer.tileValues.visit, {
        ...words,
        minutes: appointment.durationMin,
      }),
    );
    add('service', appointment.serviceLabel);
    add('doctor', named(appointment.doctorId));
    add('status', tClinic(CLINIC_KEYS.appointments.statuses[appointment.status]));
  };
  const treatment = (record: Treatment) => {
    const done = new Date(record.performedAt);
    add('treatment', record.name);
    add('doneOn', dayTime(clinicToday(done), clinicClockTime(done), now).day);
    add('session', t(TASKS_KEYS.drawer.tileValues.session, { number: record.sessionNo }));
    add('therapist', named(record.therapistId ?? record.doctorId));
  };
  const lead = (record: LeadRecord) => {
    add(
      'status',
      record.status ? tClinic(CLINIC_KEYS.leads.statuses[record.status]) : null,
    );
    add(
      'source',
      record.source ? tClinic(CLINIC_KEYS.leads.sources[record.source]) : null,
    );
    add(
      'interestedIn',
      record.interests
        .map((interest) => tClinic(CLINIC_KEYS.leads.interests[interest]))
        .join(', '),
    );
    add('owner', named(record.ownerId));
    add('mobile', record.phone ? formatClinicPhone(record.phone) : null);
  };

  if (detail.source?.kind === 'appointment') visit(detail.source.appointment);
  if (detail.source?.kind === 'treatment') treatment(detail.source.treatment);
  const person = taskContextLead(detail);
  if (person) lead(person);
  return tiles;
}
