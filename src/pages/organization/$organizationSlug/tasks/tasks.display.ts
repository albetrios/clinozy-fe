/**
 * How the Tasks room names people (KICKOFF §6.10): pure, shared by the rows,
 * New task and the task drawer.
 */

/** A staff member's full name as their cards write it ("Riya Shah", "Dr. Drashti Desai"). */
export function staffName(staff: {
  firstName: string;
  lastName?: string | null;
}): string {
  return [staff.firstName, staff.lastName].filter(Boolean).join(' ');
}
