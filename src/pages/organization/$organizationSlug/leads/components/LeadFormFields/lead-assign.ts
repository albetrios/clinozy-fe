import type { Role } from '@/shared/api/clinic/clinic-schema.ts';

/**
 * Who may hand a lead to whom (`leads.md:65`, H:5704): Front desk → Front
 * desk, Counsellor; Counsellor → Front desk, Counsellor, Doctor; Doctor →
 * Doctor, Therapist, Counsellor, Front desk. The prototype gives Admin, Owner
 * and Marketing nothing — Admin and Owner assign anyone, Marketing as Front
 * desk (AMBER A-L6).
 */
const ASSIGNABLE: Readonly<Partial<Record<Role, readonly Role[]>>> = {
  front_desk: ['front_desk', 'counsellor'],
  marketing: ['front_desk', 'counsellor'],
  counsellor: ['front_desk', 'counsellor', 'doctor'],
  doctor: ['doctor', 'therapist', 'counsellor', 'front_desk'],
};

/** Roles that assign anyone, the assignee or not. */
const ASSIGN_ANYONE: ReadonlySet<Role> = new Set<Role>(['admin', 'owner']);

/** Why "Assign" is off: only the assignee reassigns, and only to the roles theirs may. */
export type AssignRefusal = 'notAssignee' | 'role';

/** Whether "Assign" is offered, and why not. */
export type AssignCheck = { ok: true } | { ok: false; reason: AssignRefusal };

/**
 * Whether a member may assign the lead to someone (`canAssign`, H:5704): an
 * Admin or Owner always; anyone else only while they are the assignee, and
 * only to a role theirs may hand to. Several roles: any one that may.
 */
export function canAssign(
  myRoles: readonly Role[],
  theirRoles: readonly Role[],
  isOwner: boolean,
): AssignCheck {
  if (myRoles.some((role) => ASSIGN_ANYONE.has(role))) return { ok: true };
  if (!isOwner) return { ok: false, reason: 'notAssignee' };
  const allowed = myRoles.some((mine) =>
    theirRoles.some((theirs) => ASSIGNABLE[mine]?.includes(theirs) ?? false),
  );
  return allowed ? { ok: true } : { ok: false, reason: 'role' };
}
