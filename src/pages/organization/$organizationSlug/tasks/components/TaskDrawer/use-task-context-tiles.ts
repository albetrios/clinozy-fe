import { useTranslation } from 'react-i18next';

import { appClockTime, appToday } from '@/shared/api/app/app-time.ts';
import type { AppointmentRow } from '@/shared/api/app/appointments-contracts.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import type { TaskDetail } from '@/shared/api/app/tasks-contracts.ts';
import type { TreatmentRecord } from '@/shared/api/app/treatments-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { formatAppPhone } from '@/shared/app/app-phone.ts';
import { shortPersonName } from '@/shared/components/Cells/index.ts';
import { useTaskDayTimeWords } from '@/shared/hooks/useTaskDueLabel/index.ts';

import { TASKS_KEYS, TASKS_NS } from '../../tasks.constants.ts';

/** A context tile's label key. */
type TaskContextTileKey = keyof typeof TASKS_KEYS.drawer.tiles;

/** One context tile: its label and its value ("—" when the record has none). */
interface TaskContextTile {
  key: TaskContextTileKey;
  label: string;
  value: string;
}

const NONE = '—';

/** A member's short name from the team directory — none when they have left (or are loading). */
export type TaskStaffName = (membershipId: string | null) => string | null;

/** The staff names a directory gives. */
export function taskStaffName(team: ReadonlyMap<string, DirectoryMember>): TaskStaffName {
  return (membershipId) => {
    const member = membershipId ? team.get(membershipId) : undefined;
    return member ? shortPersonName(member.name) : null;
  };
}

/**
 * The context tiles (`tasks.md` › Task drawer › 3), from the record the task
 * points at (read once with the task, only under its read code — research-tasks
 * T2): a visit's "Visit · Service · Doctor · Status"; a treatment's "Treatment ·
 * Done on · Session · Therapist"; a lead's "Status · Source · Interested in ·
 * Owner · Mobile". Staff names come from the team directory. A task that points
 * at nothing — or at a record the member may not read, a check-in, a review, a
 * bill — has none.
 */
export function useTaskContextTiles(
  detail: TaskDetail,
  now: Date,
  staffName: TaskStaffName,
): TaskContextTile[] {
  const { t } = useTranslation(TASKS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const dayTime = useTaskDayTimeWords();
  const tiles: TaskContextTile[] = [];
  const add = (key: TaskContextTileKey, value: string | null | undefined) => {
    tiles.push({
      key,
      label: t(TASKS_KEYS.drawer.tiles[key]),
      value: value?.trim() ? value : NONE,
    });
  };

  const visit = (appointment: AppointmentRow) => {
    const words = dayTime(appointment.date, appointment.startTime, now);
    add(
      'visit',
      t(TASKS_KEYS.drawer.tileValues.visit, {
        ...words,
        minutes: appointment.durationMin,
      }),
    );
    add('service', appointment.serviceLabel);
    add('doctor', staffName(appointment.doctorId));
    add('status', tApp(APP_KEYS.appointments.statuses[appointment.status]));
  };
  const treatment = (record: TreatmentRecord) => {
    const done = new Date(record.performedAt);
    add('treatment', record.name);
    add('doneOn', dayTime(appToday(done), appClockTime(done), now).day);
    add(
      'session',
      t(TASKS_KEYS.drawer.tileValues.session, { number: record.sessionNumber }),
    );
    add('therapist', staffName(record.therapistId ?? record.doctorId));
  };
  const lead = (record: LeadRecord) => {
    add('status', tApp(APP_KEYS.leads.statuses[record.status]));
    add('source', record.source ? tApp(APP_KEYS.leads.sources[record.source]) : null);
    add(
      'interestedIn',
      record.interests
        .map((interest) => tApp(APP_KEYS.leads.interests[interest]))
        .join(', '),
    );
    add('owner', staffName(record.ownerId));
    add('mobile', record.phone ? formatAppPhone(record.phone) : null);
  };

  const { source } = detail;
  if (source?.kind === 'appointment') visit(source.appointment);
  if (source?.kind === 'treatment') treatment(source.treatment);
  if (source?.kind === 'lead') lead(source.lead);
  return tiles;
}
