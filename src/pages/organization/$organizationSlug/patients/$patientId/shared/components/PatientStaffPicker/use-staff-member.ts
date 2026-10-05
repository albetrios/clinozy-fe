import type { AppointmentStaff } from '@/shared/api/clinic/appointments-contracts.ts';
import { personFullName, shortPersonName } from '@/shared/components/Cells/index.ts';
import { useBookableStaff } from '@/shared/hooks/useAppointments/index.ts';

/** A picked staff member and the short name the drawers show ("Dr. Drashti P."). */
export interface StaffMember {
  person: AppointmentStaff | null;
  /** Empty while nobody is picked or the staff list has not answered. */
  shortName: string;
}

/**
 * The person a record's Doctor or Therapist names, for its badge, peek and
 * summary — from the same staff list the picker reads.
 */
export function useStaffMember(staffId: string | null): StaffMember {
  const staff = useBookableStaff();
  const person = staff.data?.find((member) => member.id === staffId) ?? null;
  return { person, shortName: person ? shortPersonName(personFullName(person)) : '' };
}
