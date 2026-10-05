import { useBookableStaff } from '@/shared/hooks/useAppointments/index.ts';
import { useMyStaffProfile } from '@/shared/hooks/useTeam/index.ts';

/** Who a new record starts with, and whether the staff list has answered. */
export interface DefaultStaff {
  id: string | null;
  ready: boolean;
}

/**
 * Who a new record's Doctor or Therapist starts as (KICKOFF §6.6; the
 * prototype's `ptDoc()` / `ptTher()`): the one on the patient's last record
 * of the kind, else the member themself when they hold the role, else — for
 * a doctor, whom a prescription needs — the first active one. A therapist
 * may stay empty.
 */
export function useDefaultStaff(
  staffRole: 'doctor' | 'therapist',
  lastId: string | null | undefined,
): DefaultStaff {
  const staff = useBookableStaff();
  const me = useMyStaffProfile();
  const people = (staff.data ?? []).filter(
    (person) => person.active && person.roles.includes(staffRole),
  );
  const ready = staff.isSuccess || staff.isError;
  if (lastId && people.some((person) => person.id === lastId))
    return { id: lastId, ready };
  const mine = me.data && people.find((person) => person.id === me.data?.id);
  if (mine) return { id: mine.id, ready };
  return { id: staffRole === 'doctor' ? (people[0]?.id ?? null) : null, ready };
}
